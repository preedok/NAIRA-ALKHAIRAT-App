const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const asyncHandler = require('express-async-handler');
const sequelize = require('../config/sequelize');
const { Invoice, InvoiceFile, Order, OrderItem, User, Branch, PaymentProof, Notification, Provinsi, Wilayah, Product, VisaProgress, TicketProgress, HotelProgress, BusProgress, Refund, OwnerProfile, OwnerBalanceTransaction, PaymentReallocation, AccountingBankAccount, Bank, InvoiceStatusHistory, OrderRevision } = require('../models');
const { INVOICE_STATUS, NOTIFICATION_TRIGGER, ORDER_ITEM_TYPE, DP_PAYMENT_STATUS, REFUND_SOURCE, isOwnerRole } = require('../constants');
const { getRulesForBranch } = require('./businessRuleController');
const { getBranchIdsForWilayah, invoiceInKoordinatorWilayah } = require('../utils/wilayahScope');

const KOORDINATOR_ROLES = ['invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'];
function isKoordinatorRole(role) {
  return KOORDINATOR_ROLES.includes(role);
}

/** Atribut PaymentProof untuk include (tanpa proof_file_name, proof_file_content_type, proof_file_data agar kompatibel dengan DB yang belum punya kolom tersebut; setelah migration 20260327000001 jalan, bisa tambah proof_file_name) */
const PAYMENT_PROOF_ATTRS = ['id', 'invoice_id', 'payment_type', 'amount', 'payment_currency', 'amount_original', 'amount_idr', 'amount_sar', 'bank_id', 'bank_name', 'account_number', 'sender_account_name', 'sender_account_number', 'recipient_bank_account_id', 'transfer_date', 'proof_file_url', 'uploaded_by', 'verified_by', 'verified_at', 'verified_status', 'notes', 'issued_by', 'payment_location', 'reconciled_at', 'reconciled_by', 'created_at', 'updated_at'];
const { buildInvoicePdfBuffer, getEffectiveStatusLabel } = require('../utils/invoicePdf');
const { SUBDIRS, getDir, invoiceFilename, toUrlPath } = require('../config/uploads');
const { sendInvoiceCreatedEmail, sendPaymentReceivedEmail } = require('../utils/emailService');
const logger = require('../config/logger');

const generateInvoiceNumber = () => {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 99999) + 1;
  return `INV-${y}-${String(n).padStart(5, '0')}`;
};

/** Kirim notifikasi invoice baru ke email owner dengan lampiran PDF (jalan di background). */
async function sendInvoiceCreatedNotificationEmail(invoiceId, notificationId, dueInfo) {
  try {
    const invoice = await Invoice.findByPk(invoiceId, {
      include: [
        { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
        { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
        { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
        { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }
      ]
    });
    if (!invoice || !invoice.User) return;
    const data = invoice.toJSON();
    const effectiveRates = await getEffectiveKursForInvoice(invoice, invoice.Order);
    data.currency_rates = effectiveRates;
    data.currency_rates_override = effectiveRates;
    const pdfBuffer = await buildInvoicePdfBuffer(data);
    const sent = await sendInvoiceCreatedEmail(
      invoice.User.email,
      invoice.User.name,
      invoice.invoice_number,
      invoice.invoice_number,
      pdfBuffer,
      dueInfo
    );
    if (sent && notificationId) await Notification.update({ email_sent_at: new Date() }, { where: { id: notificationId } });
  } catch (err) {
    logger.error('sendInvoiceCreatedNotificationEmail failed: ' + (err.message || String(err)));
  }
}

/** Kirim notifikasi DP/Lunas ke email owner dengan lampiran bukti bayar + invoice PDF (background). */
async function sendPaymentReceivedNotificationEmail(invoiceId, notificationId, paymentProofId, isLunas) {
  try {
    const invoice = await Invoice.findByPk(invoiceId, {
      include: [
        { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
        { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
        { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
        { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }
      ]
    });
    if (!invoice || !invoice.User) return;
    let paymentProofPath = null;
    if (paymentProofId) {
      const proof = await PaymentProof.findByPk(paymentProofId, { attributes: ['id', 'proof_file_url', 'amount'] });
      if (proof && proof.proof_file_url) {
        const urlNorm = (proof.proof_file_url || '').replace(/\\/g, '/').trim();
        const match = urlNorm.match(/payment-proofs\/?(.+)$/i);
        const filename = match ? match[1].replace(/^\/+/, '').split('/').pop() : path.basename(urlNorm);
        if (filename) {
          const proofDir = getDir(SUBDIRS.PAYMENT_PROOFS || 'payment-proofs');
          const fullPath = path.join(proofDir, filename);
          if (fs.existsSync(fullPath)) paymentProofPath = fullPath;
        }
      }
    }
    const data = invoice.toJSON();
    const effectiveRates = await getEffectiveKursForInvoice(invoice, invoice.Order);
    data.currency_rates = effectiveRates;
    data.currency_rates_override = effectiveRates;
    const pdfBuffer = await buildInvoicePdfBuffer(data);
    const paidAmount = parseFloat(invoice.paid_amount) || 0;
    const sent = await sendPaymentReceivedEmail(
      invoice.User.email,
      invoice.User.name,
      invoice.invoice_number,
      paidAmount,
      isLunas,
      paymentProofPath,
      pdfBuffer
    );
    if (sent && notificationId) await Notification.update({ email_sent_at: new Date() }, { where: { id: notificationId } });
  } catch (err) {
    logger.error('sendPaymentReceivedNotificationEmail failed: ' + (err.message || String(err)));
  }
}

async function logInvoiceStatusChange({ invoice_id, from_status, to_status, changed_by, reason, meta, changed_at, transaction }) {
  try {
    await InvoiceStatusHistory.create({
      invoice_id,
      from_status: from_status ?? null,
      to_status,
      changed_at: changed_at || new Date(),
      changed_by: changed_by || null,
      reason: reason || null,
      meta: meta && typeof meta === 'object' ? meta : {}
    }, transaction ? { transaction } : undefined);
  } catch (e) {
    // Jangan mengganggu flow utama jika logging gagal
    // eslint-disable-next-line no-console
    console.error('logInvoiceStatusChange failed:', e?.message || e);
  }
}

/**
 * Update order.dp_payment_status dan order.dp_percentage_paid dari invoice.
 * tagihan_dp = belum ada DP terverifikasi; pembayaran_dp = sudah ada bukti bayar DP.
 * Jangan turunkan ke tagihan_dp jika sudah pernah ada pembayaran (mis. setelah edit order total naik).
 */
async function updateOrderDpStatusFromInvoice(invoice, order = null) {
  if (!order) order = await Order.findByPk(invoice.order_id, { attributes: ['id', 'total_amount', 'currency', 'dp_payment_status'] });
  if (!order) return;
  const total = parseFloat(invoice.total_amount) || 0;
  const paid = parseFloat(invoice.paid_amount) || 0;
  const dpAmount = parseFloat(invoice.dp_amount) || 0;
  const pct = total > 0 ? Math.round((paid / total) * 10000) / 100 : null;
  const isIssued = [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED].includes(invoice.status);
  const dpMetByPayment = dpAmount > 0 && paid >= dpAmount;
  const hadAnyPayment = paid > 0;
  const alreadyPembayaranDp = isIssued && [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED].includes(invoice.status);
  const orderWasPembayaranDp = order.dp_payment_status === DP_PAYMENT_STATUS.PEMBAYARAN_DP;
  const hasDpPaid = dpMetByPayment || (hadAnyPayment && (alreadyPembayaranDp || orderWasPembayaranDp));
  const dpPaymentStatus = !isIssued ? null : (hasDpPaid ? DP_PAYMENT_STATUS.PEMBAYARAN_DP : DP_PAYMENT_STATUS.TAGIHAN_DP);
  const orderTotal = parseFloat(order.total_amount) || 0;
  const rates = await getEffectiveKursForInvoice(invoice, order);
  const sarToIdr = rates.SAR_TO_IDR && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const payload = {
    dp_payment_status: dpPaymentStatus,
    dp_percentage_paid: pct,
    total_amount_idr: total,
    total_amount_sar: total / sarToIdr
  };
  await order.update(payload);
}

async function updateInvoiceWithAudit(invoice, updates, { changedBy, reason, meta, transaction } = {}) {
  const nextStatus = updates && Object.prototype.hasOwnProperty.call(updates, 'status') ? updates.status : undefined;
  // Hanya catat riwayat status bila status benar-benar berubah (jangan setiap sync form order → duplicate "Pembayaran DP")
  const willLog = nextStatus != null && String(nextStatus) !== String(invoice.status);
  if (willLog) {
    await logInvoiceStatusChange({
      invoice_id: invoice.id,
      from_status: invoice.status,
      to_status: nextStatus,
      changed_by: changedBy || null,
      reason,
      meta,
      transaction
    });
  }
  await invoice.update(updates, transaction ? { transaction } : undefined);
  return invoice;
}

async function ensureBlockedStatus(invoice) {
  if (invoice.status !== INVOICE_STATUS.TENTATIVE || invoice.is_blocked) return;
  if (invoice.unblocked_at) return;
  const at = invoice.auto_cancel_at ? new Date(invoice.auto_cancel_at) : null;
  if (at && new Date() > at && parseFloat(invoice.paid_amount) === 0) {
    await invoice.update({ is_blocked: true });
    const order = await Order.findByPk(invoice.order_id);
    if (order) await order.update({ status: 'blocked', blocked_at: new Date(), blocked_reason: 'DP lewat 1x24 jam' });
  }
}

/**
 * Hitung ulang paid_amount dan status invoice dari semua bukti bayar yang verified.
 * Pembayaran KES (payment_location = saudi) selalu dianggap terverifikasi, tidak perlu konfirmasi admin.
 */
async function recalcInvoiceFromVerifiedProofs(invoice, { changedBy, reason, meta } = {}) {
  const proofs = await PaymentProof.findAll({
    where: {
      invoice_id: invoice.id,
      [Op.or]: [
        { verified_status: 'verified' },
        { payment_location: 'saudi' }
      ]
    },
    attributes: PAYMENT_PROOF_ATTRS
  });
  const verifiedSum = proofs.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const total = parseFloat(invoice.total_amount) || 0;
  const dpAmount = parseFloat(invoice.dp_amount) || 0;
  const remaining = Math.max(0, total - verifiedSum);
  let newStatus;
  if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
  else if (dpAmount > 0 && verifiedSum >= dpAmount) newStatus = INVOICE_STATUS.PARTIAL_PAID; // Pembayaran DP (DP terpenuhi)
  else if (verifiedSum > 0) newStatus = INVOICE_STATUS.PARTIAL_PAID; // Ada pembayaran terverifikasi
  else newStatus = INVOICE_STATUS.TENTATIVE; // Tagihan DP
  await updateInvoiceWithAudit(invoice, {
    paid_amount: verifiedSum,
    remaining_amount: remaining,
    status: newStatus
  }, { changedBy, reason: reason || 'recalc_from_verified_proofs', meta: { ...(meta || {}), verified_sum: verifiedSum } });
  const invReload = await Invoice.findByPk(invoice.id, { attributes: ['id', 'order_id', 'total_amount', 'paid_amount', 'dp_amount', 'status'] });
  if (invReload) await updateOrderDpStatusFromInvoice(invReload);
  return { verifiedSum, remaining, newStatus };
}

/**
 * GET /api/v1/invoices
 * Sumber utama daftar transaksi: semua GET yang menampilkan order/invoice terintegrasi dengan data invoice ini.
 * Dashboard, report, accounting, dan divisi (hotel/visa/ticket/bus) mengacu data dari invoice.
 */
const ALLOWED_SORT = ['invoice_number', 'created_at', 'total_amount', 'status'];

async function resolveBranchFilterList(branch_id, provinsi_id, wilayah_id, user) {
  if (!user) return branch_id ? { branch_id } : {};
  // Role hotel, bus, handling: lihat semua wilayah (tidak batasi by branch/wilayah)
  if (user.role === 'role_hotel' || user.role === 'role_bus' || user.role === 'handling') return {};
  // Role invoice Saudi: lihat semua invoice seluruh wilayah (filter branch hanya jika dikirim eksplisit)
  if (user.role === 'invoice_saudi') return branch_id ? { branch_id } : {};
  // Koordinator / invoice koordinator: scope ke semua cabang di wilayah mereka
  if (isKoordinatorRole(user.role)) {
    let effectiveWilayahId = user.wilayah_id;
    if (!effectiveWilayahId && user.branch_id) {
      try {
        const branch = await Branch.findByPk(user.branch_id, {
          attributes: ['id'],
          include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }]
        });
        if (branch?.Provinsi?.wilayah_id) effectiveWilayahId = branch.Provinsi.wilayah_id;
      } catch (_) {
        // ignore
      }
    }
    if (effectiveWilayahId) {
      const ids = await getBranchIdsForWilayah(effectiveWilayahId);
      if (ids.length > 0) return { branch_id: { [Op.in]: ids } };
      if (user.branch_id) return { branch_id: user.branch_id };
      // Wilayah tidak punya cabang ter-link: jangan filter (tampilkan semua invoice) agar koordinator tetap bisa lihat data
      return {};
    }
    if (user.branch_id) return { branch_id: user.branch_id };
    return {};
  }
  // Owner: jangan scope by branch di sini agar mereka lihat semua invoice milik mereka
  if (isOwnerRole(user.role)) return branch_id ? { branch_id } : {};
  if (user.branch_id && !['super_admin', 'admin_pusat', 'role_accounting'].includes(user.role)) return { branch_id: user.branch_id };
  if (branch_id) return { branch_id };
  if (provinsi_id) {
    const branches = await Branch.findAll({ where: { provinsi_id, is_active: true }, attributes: ['id'] });
    const ids = branches.map(b => b.id);
    return ids.length ? { branch_id: { [Op.in]: ids } } : { branch_id: { [Op.in]: [] } };
  }
  if (wilayah_id) {
    const branches = await Branch.findAll({
      where: { is_active: true },
      attributes: ['id'],
      include: [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }]
    });
    const ids = branches.map(b => b.id);
    return ids.length ? { branch_id: { [Op.in]: ids } } : { branch_id: { [Op.in]: [] } };
  }
  return {};
}

const list = asyncHandler(async (req, res) => {
  const { status, branch_id, provinsi_id, wilayah_id, owner_id, order_status, invoice_number, date_from, date_to, due_status, has_handling, limit = 25, page = 1, sort_by, sort_order } = req.query;
  const where = {};
  if (status) where.status = status;
  const branchFilter = await resolveBranchFilterList(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (owner_id) where.owner_id = owner_id;
  if (invoice_number) where.invoice_number = { [Op.iLike]: `%${String(invoice_number).trim()}%` };
  if (has_handling === true || has_handling === 'true' || has_handling === '1') {
    const handlingRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HANDLING }, attributes: ['order_id'], raw: true });
    const orderIdsWithHandling = [...new Set((handlingRows || []).map((r) => r.order_id))];
    where.order_id = orderIdsWithHandling.length ? { [Op.in]: orderIdsWithHandling } : { [Op.in]: [] };
  }
  if (date_from || date_to) {
    where.issued_at = {};
    if (date_from) where.issued_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.issued_at[Op.lte] = d;
    }
  }
  if (due_status) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (due_status === 'current') {
      where.due_date_dp = { [Op.gt]: endOfToday };
    } else if (due_status === 'due') {
      where.due_date_dp = { [Op.between]: [startOfToday, endOfToday] };
    } else if (due_status === 'overdue') {
      where.due_date_dp = { [Op.lt]: startOfToday };
      where.remaining_amount = { [Op.gt]: 0 };
    }
  }
  if (isOwnerRole(req.user.role)) where.owner_id = req.user.id;
  // Role hotel/bus/handling/visa_koordinator/tiket_koordinator: hanya tampilkan invoice dengan status pembayaran_dp (sudah ada bukti bayar DP), agar tampil di menu Invoice dan Progress.
  const divisiProgressRoles = ['role_hotel', 'role_bus', 'handling', 'visa_koordinator', 'tiket_koordinator'];
  if (divisiProgressRoles.includes(req.user.role)) {
    let orderIdsByType = [];
    if (req.user.role === 'role_hotel') {
      const hotelRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HOTEL }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((hotelRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_bus') {
      const busRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((busRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'handling') {
      const handlingRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HANDLING }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((handlingRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'visa_koordinator') {
      const visaRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((visaRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'tiket_koordinator') {
      const ticketRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.TICKET }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((ticketRows || []).map((r) => r.order_id))];
    }
    const orderIdsWithDpPaid = orderIdsByType.length
      ? (await Order.findAll({ where: { id: { [Op.in]: orderIdsByType }, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP }, attributes: ['id'], raw: true })).map((o) => o.id)
      : [];
    where.order_id = orderIdsWithDpPaid.length ? { [Op.in]: orderIdsWithDpPaid } : { [Op.in]: [] };
  }
  // Untuk owner: jangan filter branch_id agar semua invoice milik mereka tampil (order bisa punya branch dari form).
  // role_accounting, invoice_saudi, role_hotel, role_bus, handling: lihat invoice sesuai scope (tidak paksa branch_id user).
  if (req.user.branch_id && !isOwnerRole(req.user.role) && req.user.role !== 'role_hotel' && req.user.role !== 'role_bus' && req.user.role !== 'handling' && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }

  const orderInclude = {
    model: Order,
    as: 'Order',
    attributes: ['id', 'total_amount', 'currency', 'status', 'created_at', 'currency_rates_override', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at', 'total_amount_idr', 'total_amount_sar'],
    include: [
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
        required: false,
        attributes: ['id', 'type', 'quantity'],
        include: [
          { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
          { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
          { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
          { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
        ]
      }
    ]
  };
  if (order_status) {
    orderInclude.required = true;
    orderInclude.where = { status: order_status };
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderBy = [[sortCol, sortDir]];

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [
      orderInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }
    ],
    order: orderBy,
    limit: lim,
    offset,
    distinct: true
  });

  for (const inv of rows) await ensureBlockedStatus(inv);
  const totalPages = Math.ceil(count / lim) || 1;

  // Serialize list; nested OrderItems bisa tidak ter-load dengan findAndCountAll+distinct, jadi load terpisah lalu merge
  const data = rows.map((row) => {
    const plain = row.get ? row.get({ plain: true }) : (typeof row.toJSON === 'function' ? row.toJSON() : row);
    if (plain.Order && !Array.isArray(plain.Order.OrderItems)) plain.Order.OrderItems = [];
    plain.owner_is_mou = !!(plain.User && plain.User.OwnerProfile && plain.User.OwnerProfile.is_mou_owner);
    return plain;
  });

  const orderIdsFromRows = [...new Set(data.map((d) => d.order_id).filter(Boolean))];
  let orderItemsByOrderId = {};
  if (orderIdsFromRows.length > 0) {
    const items = await OrderItem.findAll({
      where: { order_id: orderIdsFromRows, type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
      include: [
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false },
        { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
        { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
        { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
        { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
      ],
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'manifest_file_url', 'meta']
    });
    for (const it of items) {
      const oid = it.order_id;
      if (!orderItemsByOrderId[oid]) orderItemsByOrderId[oid] = [];
      const plain = it.get ? it.get({ plain: true }) : it;
      plain.product_name = (plain.Product && plain.Product.name) ? plain.Product.name : null;
      plain.product_type = plain.type || (plain.Product && plain.Product.type) || null;
      orderItemsByOrderId[oid].push(plain);
    }
  }
  for (const d of data) {
    if (d.order_id) {
      if (!d.Order) d.Order = {};
      d.Order.OrderItems = orderItemsByOrderId[d.order_id] || [];
    }
  }

  const invoiceIds = data.map((d) => d.id).filter(Boolean);
  if (invoiceIds.length > 0) {
    const refundsList = await Refund.findAll({
      where: { invoice_id: { [Op.in]: invoiceIds } },
      attributes: ['invoice_id', 'status', 'amount'],
      order: [['created_at', 'DESC']],
      raw: true
    });
    const refundsByInvId = refundsList.reduce((acc, r) => {
      if (!acc[r.invoice_id]) acc[r.invoice_id] = [];
      acc[r.invoice_id].push(r);
      return acc;
    }, {});
    for (const d of data) {
      d.Refunds = refundsByInvId[d.id] || [];
    }
  }

  const refundCanceledIds = data.filter((d) => (d.status || '').toLowerCase() === 'refund_canceled').map((d) => d.id);
  if (refundCanceledIds.length > 0) {
    const refunds = await Refund.findAll({
      where: { invoice_id: { [Op.in]: refundCanceledIds }, source: REFUND_SOURCE.CANCEL },
      attributes: ['invoice_id', 'amount'],
      raw: true
    });
    const amountByInvId = refunds.reduce((acc, r) => { acc[r.invoice_id] = parseFloat(r.amount) || 0; return acc; }, {});
    for (const d of data) {
      if ((d.status || '').toLowerCase() === 'refund_canceled') d.cancel_refund_amount = amountByInvId[d.id] ?? null;
    }
  }

  if (invoiceIds.length > 0) {
    const [reallocOut, reallocIn] = await Promise.all([
      PaymentReallocation.findAll({
        where: { source_invoice_id: { [Op.in]: invoiceIds } },
        include: [{ model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number'] }],
        order: [['created_at', 'DESC']],
        raw: false
      }),
      PaymentReallocation.findAll({
        where: { target_invoice_id: { [Op.in]: invoiceIds } },
        include: [{ model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number'] }],
        order: [['created_at', 'DESC']],
        raw: false
      })
    ]);
    const outByInvId = (reallocOut || []).reduce((acc, r) => {
      const sid = r.source_invoice_id;
      if (!acc[sid]) acc[sid] = [];
      acc[sid].push(r.get ? r.get({ plain: true }) : { amount: r.amount, TargetInvoice: r.TargetInvoice ? { id: r.TargetInvoice.id, invoice_number: r.TargetInvoice.invoice_number } : null });
      return acc;
    }, {});
    const inByInvId = (reallocIn || []).reduce((acc, r) => {
      const tid = r.target_invoice_id;
      if (!acc[tid]) acc[tid] = [];
      acc[tid].push(r.get ? r.get({ plain: true }) : { amount: r.amount, SourceInvoice: r.SourceInvoice ? { id: r.SourceInvoice.id, invoice_number: r.SourceInvoice.invoice_number } : null });
      return acc;
    }, {});
    for (const d of data) {
      d.ReallocationsOut = outByInvId[d.id] || [];
      d.ReallocationsIn = inByInvId[d.id] || [];
    }
  }

  const [totalAmount, totalPaid, totalRemaining, invoiceRows, orderRows] = await Promise.all([
    Invoice.sum('total_amount', { where }),
    Invoice.sum('paid_amount', { where }),
    Invoice.sum('remaining_amount', { where }),
    Invoice.findAll({ where, include: [orderInclude], attributes: ['id', 'status', 'order_id'], raw: true }),
    Invoice.findAll({
      where,
      include: [{ model: Order, as: 'Order', attributes: ['id', 'owner_id', 'status'], required: !!order_status, where: order_status ? orderInclude.where : undefined }],
      attributes: ['order_id'],
      raw: true
    })
  ]);

  const orderIds = [...new Set((orderRows || []).map((r) => r.order_id).filter(Boolean))];
  // invoiceRows bisa duplikat karena include Order+OrderItems (satu invoice = banyak baris); hitung unik per invoice
  const seenInvoiceIds = new Set();
  const byInvoiceStatus = (invoiceRows || []).reduce((acc, r) => {
    if (seenInvoiceIds.has(r.id)) return acc;
    seenInvoiceIds.add(r.id);
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  let byOrderStatus = {};
  if (orderIds.length > 0) {
    const orders = await Order.findAll({ where: { id: { [Op.in]: orderIds } }, attributes: ['status'], raw: true });
    byOrderStatus = (orders || []).reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
  }

  // Card Dibayar: jangan gabungkan dana yang sudah di-refund
  const summaryInvoiceIds = [...new Set((invoiceRows || []).map((r) => r.id).filter(Boolean))];
  let totalPaidFinal = parseFloat(totalPaid || 0);
  if (summaryInvoiceIds.length > 0) {
    const refundedSum = await Refund.sum('amount', { where: { status: 'refunded', invoice_id: { [Op.in]: summaryInvoiceIds } } }) || 0;
    totalPaidFinal = Math.max(0, totalPaidFinal - parseFloat(refundedSum));
  }

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    success: true,
    data,
    pagination: { total: count, page: pg, limit: lim, totalPages },
    summary: {
      total_invoices: count,
      total_orders: orderIds.length,
      total_amount: parseFloat(totalAmount || 0),
      total_paid: totalPaidFinal,
      total_remaining: parseFloat(totalRemaining || 0),
      by_invoice_status: byInvoiceStatus,
      by_order_status: byOrderStatus
    }
  });
});

/**
 * GET /api/v1/invoices/draft-orders
 * Mengembalikan order dengan status draft yang belum punya invoice (untuk ditampilkan di daftar invoice).
 */
const listDraftOrders = asyncHandler(async (req, res) => {
  const branchFilter = await resolveBranchFilterList(req.query.branch_id, req.query.provinsi_id, req.query.wilayah_id, req.user);
  const withInvIds = (await Invoice.findAll({ attributes: ['order_id'], raw: true })).map((r) => r.order_id).filter(Boolean);
  const orderWhereDraft = { status: 'draft', id: { [Op.notIn]: withInvIds.length ? withInvIds : [null] } };
  if (isOwnerRole(req.user.role)) orderWhereDraft.owner_id = req.user.id;
  if (Object.keys(branchFilter).length) Object.assign(orderWhereDraft, branchFilter);
  if (req.user.role === 'role_hotel') {
    const hotelRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HOTEL }, attributes: ['order_id'], raw: true });
    const hotelOrderIds = [...new Set((hotelRows || []).map((r) => r.order_id))].filter((id) => !withInvIds.includes(id));
    orderWhereDraft.id = hotelOrderIds.length ? { [Op.in]: hotelOrderIds } : { [Op.in]: [] };
  }
  if (req.user.role === 'role_bus') {
    const busRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true });
    const busOrderIds = [...new Set((busRows || []).map((r) => r.order_id))].filter((id) => !withInvIds.includes(id));
    orderWhereDraft.id = busOrderIds.length ? { [Op.in]: busOrderIds } : { [Op.in]: [] };
  }
  if (req.user.role === 'visa_koordinator' && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    const visaRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true });
    const visaOrderIds = [...new Set((visaRows || []).map((r) => r.order_id))];
    const draftWithVisa = await Order.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: visaOrderIds.length ? visaOrderIds : [null] } },
          { id: { [Op.notIn]: withInvIds.length ? withInvIds : [null] } },
          { branch_id: { [Op.in]: branchIds.length ? branchIds : [] } },
          { status: 'draft' }
        ]
      },
      attributes: ['id'],
      raw: true
    });
    orderWhereDraft.id = draftWithVisa.length ? { [Op.in]: draftWithVisa.map((o) => o.id) } : { [Op.in]: [] };
  }
  if (req.user.role === 'tiket_koordinator' && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    const ticketRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.TICKET }, attributes: ['order_id'], raw: true });
    const ticketOrderIds = [...new Set((ticketRows || []).map((r) => r.order_id))];
    const draftWithTicket = await Order.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.in]: ticketOrderIds.length ? ticketOrderIds : [null] } },
          { id: { [Op.notIn]: withInvIds.length ? withInvIds : [null] } },
          { branch_id: { [Op.in]: branchIds.length ? branchIds : [] } },
          { status: 'draft' }
        ]
      },
      attributes: ['id'],
      raw: true
    });
    orderWhereDraft.id = draftWithTicket.length ? { [Op.in]: draftWithTicket.map((o) => o.id) } : { [Op.in]: [] };
  }
  const draftOrderInclude = [
    { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
    { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
    {
      model: OrderItem,
      as: 'OrderItems',
      where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
      required: false,
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta'],
      include: [
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false },
        { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
        { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
        { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
        { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
      ]
    }
  ];
  const draftOrders = await Order.findAll({
    where: orderWhereDraft,
    include: draftOrderInclude,
    order: [['created_at', 'DESC']]
  });
  const data = draftOrders.map((ord) => {
    const plain = ord.get ? ord.get({ plain: true }) : ord;
    const total = parseFloat(plain.total_amount) || 0;
    const orderItems = (plain.OrderItems || []).map((it) => ({
      ...it,
      product_name: (it.Product && it.Product.name) ? it.Product.name : null,
      product_type: it.type || (it.Product && it.Product.type) || null
    }));
    return {
      id: `draft-${plain.id}`,
      order_id: plain.id,
      status: 'draft',
      invoice_number: null,
      issued_at: plain.created_at,
      created_at: plain.created_at,
      total_amount: total,
      paid_amount: 0,
      remaining_amount: total,
      Order: { ...plain, OrderItems: orderItems },
      User: plain.User,
      Branch: plain.Branch,
      PaymentProofs: [],
      is_draft_order: true
    };
  });
  res.json({ success: true, data });
});

/**
 * GET /api/v1/invoices/summary
 * Same query params as list (no page/limit). Returns aggregates for Order & Invoice stats.
 */
const getSummary = asyncHandler(async (req, res) => {
  const { status, branch_id, provinsi_id, wilayah_id, owner_id, order_status, invoice_number, date_from, date_to, due_status } = req.query;
  const where = {};
  if (status) where.status = status;
  const branchFilter = await resolveBranchFilterList(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (owner_id) where.owner_id = owner_id;
  if (invoice_number) where.invoice_number = { [Op.iLike]: `%${String(invoice_number).trim()}%` };
  if (date_from || date_to) {
    where.issued_at = {};
    if (date_from) where.issued_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.issued_at[Op.lte] = d;
    }
  }
  if (due_status) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (due_status === 'current') where.due_date_dp = { [Op.gt]: endOfToday };
    else if (due_status === 'due') where.due_date_dp = { [Op.between]: [startOfToday, endOfToday] };
    else if (due_status === 'overdue') {
      where.due_date_dp = { [Op.lt]: startOfToday };
      where.remaining_amount = { [Op.gt]: 0 };
    }
  }
  if (isOwnerRole(req.user.role)) where.owner_id = req.user.id;
  if (req.user.branch_id && !isOwnerRole(req.user.role) && req.user.role !== 'role_hotel' && req.user.role !== 'role_bus' && req.user.role !== 'handling' && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }
  if (req.user.wilayah_id && isKoordinatorRole(req.user.role)) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (branchIds.length) where.branch_id = { [Op.in]: branchIds };
    // bila wilayah tidak punya cabang ter-link: jangan set filter agar summary tampil
  }
  // Role hotel/bus/handling/visa_koordinator/tiket_koordinator: summary hanya invoice yang order-nya sudah ada pembayaran DP (sama seperti list)
  const divisiProgressRolesSummary = ['role_hotel', 'role_bus', 'handling', 'visa_koordinator', 'tiket_koordinator'];
  if (divisiProgressRolesSummary.includes(req.user.role)) {
    let orderIdsByType = [];
    if (req.user.role === 'role_hotel') {
      const hotelRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HOTEL }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((hotelRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_bus') {
      const busRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((busRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'handling') {
      const handlingRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HANDLING }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((handlingRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'visa_koordinator') {
      const visaRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((visaRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'tiket_koordinator') {
      const ticketRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.TICKET }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((ticketRows || []).map((r) => r.order_id))];
    }
    const orderIdsWithDpPaid = orderIdsByType.length
      ? (await Order.findAll({ where: { id: { [Op.in]: orderIdsByType }, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP }, attributes: ['id'], raw: true })).map((o) => o.id)
      : [];
    where.order_id = orderIdsWithDpPaid.length ? { [Op.in]: orderIdsWithDpPaid } : { [Op.in]: [] };
  }

  const orderInclude = { model: Order, as: 'Order', attributes: ['id', 'owner_id', 'status'] };
  if (order_status) {
    orderInclude.required = true;
    orderInclude.where = { status: order_status };
  }

  // total_remaining = total yang belum dibayar (sisa tagihan). Total Tagihan di stat card = ini, bukan total_amount.
  const [totalInvoices, totalAmount, totalPaid, totalRemaining, invoiceRows, orderRows] = await Promise.all([
    Invoice.count({ where, include: [orderInclude], distinct: true }),
    Invoice.sum('total_amount', { where }),
    Invoice.sum('paid_amount', { where }),
    Invoice.sum('remaining_amount', { where }),
    Invoice.findAll({
      where,
      include: [orderInclude],
      attributes: ['id', 'status', 'order_id'],
      raw: true
    }),
    Invoice.findAll({
      where,
      include: [{ model: Order, as: 'Order', attributes: ['id', 'owner_id', 'status'], required: !!order_status, where: order_status ? orderInclude.where : undefined }],
      attributes: ['order_id'],
      raw: true
    })
  ]);

  const orderIds = [...new Set((orderRows || []).map((r) => r.order_id).filter(Boolean))];
  const totalOrders = orderIds.length;
  const byStatus = (invoiceRows || []).reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  let byOrderStatus = {};
  if (orderIds.length > 0) {
    const orders = await Order.findAll({
      where: { id: { [Op.in]: orderIds } },
      attributes: ['status'],
      raw: true
    });
    byOrderStatus = (orders || []).reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
  }

  // Card Dibayar: jangan gabungkan dana yang sudah di-refund (total_paid dikurangi jumlah refund selesai)
  const invoiceIds = [...new Set((invoiceRows || []).map((r) => r.id).filter(Boolean))];
  let totalPaidFinal = parseFloat(totalPaid || 0);
  if (invoiceIds.length > 0) {
    const refundedSum = await Refund.sum('amount', { where: { status: 'refunded', invoice_id: { [Op.in]: invoiceIds } } }) || 0;
    totalPaidFinal = Math.max(0, totalPaidFinal - parseFloat(refundedSum));
  }

  res.json({
    success: true,
    data: {
      total_invoices: totalInvoices || 0,
      total_orders: totalOrders,
      total_amount: parseFloat(totalAmount || 0),
      total_paid: totalPaidFinal,
      total_remaining: parseFloat(totalRemaining || 0),
      by_invoice_status: byStatus,
      by_order_status: byOrderStatus
    }
  });
});

/**
 * POST /api/v1/invoices
 * Create invoice from order. Status tentative, auto_cancel_at = now + dp_grace_hours.
 */
const create = asyncHandler(async (req, res) => {
  const { order_id, is_super_promo, dp_percentage: bodyDpPct, dp_amount: bodyDpAmount } = req.body;
  const order = await Order.findByPk(order_id, { include: ['OrderItems'] });
  if (!order) return res.status(404).json({ success: false, message: 'Trip tidak ditemukan' });
  if (order.owner_id !== req.user.id && !['invoice_koordinator', 'invoice_saudi', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }

  const existing = await Invoice.findOne({ where: { order_id } });
  if (existing) return res.status(400).json({ success: false, message: 'Trip ini sudah memiliki invoice' });

  const rules = await getRulesForBranch(order.branch_id);
  const dpGraceHours = rules.dp_grace_hours ?? 24;
  const dpDueDays = rules.dp_due_days ?? 3;
  const totalAmount = parseFloat(order.total_amount);
  const minDpPct = Math.max(0, parseInt(rules.min_dp_percentage, 10) || 30);
  let dpPercentage = is_super_promo ? 50 : (parseInt(bodyDpPct, 10) || 30);
  let dpAmount = typeof bodyDpAmount === 'number' && bodyDpAmount > 0 ? Math.round(bodyDpAmount) : Math.round(totalAmount * dpPercentage / 100);
  const minDpAmount = Math.round(totalAmount * minDpPct / 100);
  if (dpAmount < minDpAmount) {
    dpAmount = minDpAmount;
    dpPercentage = Math.round((dpAmount / totalAmount) * 100);
  }
  if (dpPercentage < minDpPct) dpPercentage = minDpPct;
  const dueDateDp = new Date();
  dueDateDp.setDate(dueDateDp.getDate() + dpDueDays);
  const autoCancelAt = new Date();
  autoCancelAt.setHours(autoCancelAt.getHours() + dpGraceHours);

  const rates = await getOrderRatesForConversion(order.id);
  const sarToIdr = rates.SAR_TO_IDR && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const invoice = await Invoice.create({
    invoice_number: generateInvoiceNumber(),
    order_id: order.id,
    owner_id: order.owner_id,
    branch_id: order.branch_id,
    total_amount: totalAmount,
    total_amount_idr: totalAmount,
    total_amount_sar: totalAmount / sarToIdr,
    dp_percentage: dpPercentage,
    dp_amount: dpAmount,
    paid_amount: 0,
    remaining_amount: totalAmount,
    status: INVOICE_STATUS.TENTATIVE,
    issued_at: new Date(),
    due_date_dp: dueDateDp,
    auto_cancel_at: autoCancelAt,
    is_overdue: false,
    terms: [
      `Invoice batal otomatis bila dalam ${dpGraceHours} jam setelah issued belum ada DP`,
      `Minimal DP ${dpPercentage}% dari total`,
      `Jatuh tempo DP ${dpDueDays} hari setelah issued`
    ]
  });
  await updateOrderDpStatusFromInvoice(invoice);
  await logInvoiceStatusChange({
    invoice_id: invoice.id,
    from_status: null,
    to_status: invoice.status,
    changed_by: req.user?.id || null,
    reason: 'invoice_created',
    meta: { order_id: order.id }
  });

  const notif = await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice baru',
    message: `Invoice ${invoice.invoice_number}. Silakan bayar DP dalam ${dpGraceHours} jam.`,
    data: { order_id: order.id, invoice_id: invoice.id },
    channel_in_app: true,
    channel_email: true
  });
  const dueInfo = `Silakan bayar DP dalam ${dpGraceHours} jam.`;
  setImmediate(() => sendInvoiceCreatedNotificationEmail(invoice.id, notif.id, dueInfo));

  const full = await Invoice.findByPk(invoice.id, { include: [{ model: Order, as: 'Order' }] });
  res.status(201).json({ success: true, data: full });
});

/**
 * Buat invoice tentative dari order (dipanggil otomatis setelah order dibuat agar Trip & Invoice table terisi).
 * @param {import('../models').Order} order - Order instance (id, owner_id, branch_id, total_amount, order_number)
 * @param {{ is_super_promo?: boolean }} opts
 * @returns {Promise<import('../models').Invoice|null>} Invoice yang dibuat, atau null jika sudah ada invoice
 */
async function createInvoiceForOrder(order, opts = {}) {
  const orderId = order.id;
  const existing = await Invoice.findOne({ where: { order_id: orderId } });
  if (existing) return existing;
  let rules = {};
  try {
    rules = await getRulesForBranch(order.branch_id) || {};
  } catch (e) {
    console.warn('createInvoiceForOrder getRulesForBranch failed, using defaults:', e?.message);
  }
  const dpGraceHours = rules.dp_grace_hours ?? 24;
  const dpDueDays = rules.dp_due_days ?? 3;
  const totalAmount = parseFloat(order.total_amount);
  const minDpPct = Math.max(0, parseInt(rules.min_dp_percentage, 10) || 30);
  let dpPercentage = opts.is_super_promo ? 50 : (opts.dp_percentage != null ? parseInt(opts.dp_percentage, 10) : 30);
  let dpAmount = typeof opts.dp_amount === 'number' && opts.dp_amount > 0 ? Math.round(opts.dp_amount) : Math.round(totalAmount * dpPercentage / 100);
  const minDpAmount = Math.round(totalAmount * minDpPct / 100);
  if (dpAmount < minDpAmount) {
    dpAmount = minDpAmount;
    dpPercentage = Math.round((dpAmount / totalAmount) * 100);
  }
  if (dpPercentage < minDpPct) dpPercentage = minDpPct;
  const dueDateDp = new Date();
  dueDateDp.setDate(dueDateDp.getDate() + dpDueDays);
  const autoCancelAt = new Date();
  autoCancelAt.setHours(autoCancelAt.getHours() + dpGraceHours);
  const rates = await getOrderRatesForConversion(orderId);
  const sarToIdr = rates.SAR_TO_IDR && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const currencyRatesSnapshot = (!order.currency_rates_override || typeof order.currency_rates_override !== 'object')
    ? (rules.currency_rates && typeof rules.currency_rates === 'object'
        ? { ...rules.currency_rates }
        : (typeof rules.currency_rates === 'string' ? (() => { try { return JSON.parse(rules.currency_rates); } catch (e) { return null; } })() : null))
    : null;
  const invoice = await Invoice.create({
    invoice_number: generateInvoiceNumber(),
    order_id: orderId,
    owner_id: order.owner_id,
    branch_id: order.branch_id,
    total_amount: totalAmount,
    total_amount_idr: totalAmount,
    total_amount_sar: totalAmount / sarToIdr,
    dp_percentage: dpPercentage,
    dp_amount: dpAmount,
    paid_amount: 0,
    remaining_amount: totalAmount,
    status: INVOICE_STATUS.TENTATIVE,
    issued_at: new Date(),
    due_date_dp: dueDateDp,
    auto_cancel_at: autoCancelAt,
    is_overdue: false,
    terms: [
      `Invoice batal otomatis bila dalam ${dpGraceHours} jam setelah issued belum ada DP`,
      `Minimal DP ${dpPercentage}% dari total`,
      `Jatuh tempo DP ${dpDueDays} hari setelah issued`
    ],
    currency_rates_snapshot: currencyRatesSnapshot
  });
  await logInvoiceStatusChange({
    invoice_id: invoice.id,
    from_status: null,
    to_status: invoice.status,
    changed_by: opts?.created_by || null,
    reason: 'invoice_auto_created',
    meta: { order_id: orderId }
  });
  await updateOrderDpStatusFromInvoice(invoice);
  const notif = await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice baru',
    message: `Invoice ${invoice.invoice_number}. Silakan bayar DP dalam ${dpGraceHours} jam.`,
    data: { order_id: orderId, invoice_id: invoice.id },
    channel_in_app: true,
    channel_email: true
  });
  const dueInfo = `Silakan bayar DP dalam ${dpGraceHours} jam.`;
  setImmediate(() => sendInvoiceCreatedNotificationEmail(invoice.id, notif.id, dueInfo));
  return invoice;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/invoices/:id
 */
const getById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  }
  const invoice = await Invoice.findByPk(id, {
    include: [
      { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false }, { model: VisaProgress, as: 'VisaProgress', required: false }, { model: TicketProgress, as: 'TicketProgress', required: false }, { model: HotelProgress, as: 'HotelProgress', required: false }, { model: BusProgress, as: 'BusProgress', required: false }] }] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: PaymentProof, as: 'PaymentProofs', attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] },
      { model: Refund, as: 'Refunds', required: false, order: [['created_at', 'DESC']] },
      { model: PaymentReallocation, as: 'ReallocationsOut', required: false, include: [{ model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number'] }], order: [['created_at', 'DESC']] },
      { model: PaymentReallocation, as: 'ReallocationsIn', required: false, include: [{ model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number'] }], order: [['created_at', 'DESC']] }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (isOwnerRole(req.user.role) && invoice.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  if (isKoordinatorRole(req.user.role)) {
    const inWilayah = await invoiceInKoordinatorWilayah(invoice, req.user.wilayah_id);
    if (!inWilayah) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
  }
  if (req.user.role === 'role_hotel') {
    const order = invoice.Order || await Order.findByPk(invoice.order_id, { include: [{ model: OrderItem, as: 'OrderItems', attributes: ['type'] }] });
    const hasHotel = (order?.OrderItems || []).some((it) => it.type === 'hotel');
    if (!hasHotel) return res.status(403).json({ success: false, message: 'Invoice ini tidak berisi item hotel' });
  }
  if (req.user.role === 'role_bus') {
    const order = invoice.Order || await Order.findByPk(invoice.order_id, { include: [{ model: OrderItem, as: 'OrderItems', attributes: ['type'] }] });
    const hasBus = (order?.OrderItems || []).some((it) => it.type === 'bus');
    if (!hasBus) return res.status(403).json({ success: false, message: 'Invoice ini tidak berisi item bus' });
  }
  await ensureBlockedStatus(invoice);
  // Sinkronkan paid_amount dari jumlah semua bukti terverifikasi (KES otomatis terverifikasi + transfer yang dikonfirmasi)
  const proofs = invoice.PaymentProofs || [];
  const verifiedSum = proofs
    .filter(p => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at != null && p.verified_status !== 'rejected'))
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const currentPaid = parseFloat(invoice.paid_amount) || 0;
  if (Math.abs(verifiedSum - currentPaid) > 0.01) {
    const totalInv = parseFloat(invoice.total_amount) || 0;
    const remaining = Math.max(0, totalInv - verifiedSum);
    let newStatus = invoice.status;
    if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
    else if ((parseFloat(invoice.dp_amount) || 0) > 0 && verifiedSum >= parseFloat(invoice.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    else if (verifiedSum > 0 && [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED].includes(invoice.status)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    await updateInvoiceWithAudit(invoice, { paid_amount: verifiedSum, remaining_amount: remaining, status: newStatus }, { changedBy: null, reason: 'sync_paid_on_get', meta: { verified_sum: verifiedSum } });
    invoice.paid_amount = verifiedSum;
    invoice.remaining_amount = remaining;
    invoice.status = newStatus;
  } else if (invoice.status === INVOICE_STATUS.TENTATIVE && verifiedSum > 0) {
    const dpAmt = parseFloat(invoice.dp_amount) || 0;
    if (dpAmt > 0 && verifiedSum >= dpAmt) {
      await updateInvoiceWithAudit(invoice, { status: INVOICE_STATUS.PARTIAL_PAID }, { changedBy: null, reason: 'sync_paid_on_get', meta: { verified_sum: verifiedSum } });
      invoice.status = INVOICE_STATUS.PARTIAL_PAID;
    }
  }
  const data = invoice.toJSON();
  data.owner_is_mou = !!(data.User && data.User.OwnerProfile && data.User.OwnerProfile.is_mou_owner);
  const effectiveRates = await getEffectiveKursForInvoice(invoice, invoice.Order);
  data.currency_rates = effectiveRates;
  data.currency_rates_override = effectiveRates;
  if ((data.status || '').toLowerCase() === 'refund_canceled' && Array.isArray(data.Refunds)) {
    const cancelRefund = data.Refunds.find((r) => r.source === REFUND_SOURCE.CANCEL);
    data.cancel_refund_amount = cancelRefund != null ? parseFloat(cancelRefund.amount) || null : null;
  }
  // Rekening bank untuk pembayaran: dari Data Rekening Bank (accounting), agar owner/role lain dapat daftar tanpa akses API accounting
  const rules = await getRulesForBranch(invoice.branch_id);
  const accountingBankAccounts = await AccountingBankAccount.findAll({
    where: { is_active: true },
    order: [['bank_name', 'ASC'], ['account_number', 'ASC']],
    attributes: ['id', 'code', 'name', 'bank_name', 'account_number', 'currency']
  });
  data.bank_accounts = accountingBankAccounts.length > 0 ? accountingBankAccounts.map((a) => a.toJSON()) : (Array.isArray(rules.bank_accounts) ? rules.bank_accounts : (typeof rules.bank_accounts === 'string' ? (() => { try { return JSON.parse(rules.bank_accounts); } catch (e) { return []; } })() : []));
  res.json({ success: true, data });
});

/**
 * PATCH /api/v1/invoices/:id/unblock
 * Role invoice: aktifkan kembali order yang diblokir (lewat waktu DP).
 */
const unblock = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang mengaktifkan invoice' });
  }
  if (isKoordinatorRole(req.user.role) && invoice) {
    const inWilayah = await invoiceInKoordinatorWilayah(invoice, req.user.wilayah_id);
    if (!inWilayah) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
  }
  const rules = await getRulesForBranch(invoice.branch_id);
  const dpGraceHours = Math.max(1, parseInt(rules.dp_grace_hours, 10) || 24);
  const newAutoCancelAt = new Date();
  newAutoCancelAt.setHours(newAutoCancelAt.getHours() + dpGraceHours);
  await invoice.update({
    is_blocked: false,
    unblocked_by: req.user.id,
    unblocked_at: new Date(),
    auto_cancel_at: newAutoCancelAt
  });
  const order = await Order.findByPk(invoice.order_id);
  if (order && order.status === 'blocked') {
    await order.update({ status: 'tentative', unblocked_by: req.user.id, unblocked_at: new Date(), blocked_at: null, blocked_reason: null });
  }
  const notif = await Notification.create({
    user_id: invoice.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice diaktifkan kembali',
    message: `Invoice ${invoice.invoice_number} dapat dibayar kembali. Silakan upload bukti DP.`,
    data: { invoice_id: invoice.id },
    channel_in_app: true,
    channel_email: true
  });
  setImmediate(() => sendInvoiceCreatedNotificationEmail(invoice.id, notif.id, 'Silakan upload bukti DP.'));
  const full = await Invoice.findByPk(invoice.id, { include: [{ model: Order, as: 'Order' }] });
  res.json({ success: true, data: full });
});

/**
 * POST /api/v1/invoices/:id/verify-payment
 * Body: { payment_proof_id, verified (bool), notes? }
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { payment_proof_id, verified, notes } = req.body;
  const isApproved = verified === true || verified === 'true';
  const proof = await PaymentProof.findByPk(payment_proof_id, { attributes: PAYMENT_PROOF_ATTRS });
  if (!proof || proof.invoice_id !== req.params.id) return res.status(404).json({ success: false, message: 'Bukti bayar tidak ditemukan' });
  // Hanya karyawan (bukan owner/pembeli) yang boleh verifikasi
  const allowedVerify = ['admin_pusat', 'invoice_koordinator', 'invoice_saudi', 'role_accounting', 'super_admin'];
  if (!allowedVerify.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang verifikasi' });
  }
  const invoice = await Invoice.findByPk(proof.invoice_id);
  if (isKoordinatorRole(req.user.role) && invoice) {
    const inWilayah = await invoiceInKoordinatorWilayah(invoice, req.user.wilayah_id);
    if (!inWilayah) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
  }
  if (isApproved) {
    await proof.update({ verified_by: req.user.id, verified_at: new Date(), verified_status: 'verified', notes: notes || proof.notes });
    const inv = await Invoice.findByPk(invoice.id);
    const { newStatus } = await recalcInvoiceFromVerifiedProofs(inv, { changedBy: req.user.id, reason: 'payment_proof_verified', meta: { payment_proof_id: proof.id } });
    if (newStatus === INVOICE_STATUS.PAID) {
      const order = await Order.findByPk(inv.order_id);
      if (order && !['completed', 'cancelled'].includes(order.status)) {
        await order.update({ status: 'processing' });
      }
    }
    const notif = await Notification.create({
      user_id: inv.owner_id,
      trigger: newStatus === INVOICE_STATUS.PAID ? NOTIFICATION_TRIGGER.LUNAS : NOTIFICATION_TRIGGER.DP_RECEIVED,
      title: newStatus === INVOICE_STATUS.PAID ? 'Invoice lunas' : 'DP diterima',
      message: `Pembayaran untuk ${inv.invoice_number} telah diverifikasi.`,
      data: { invoice_id: inv.id, payment_proof_id: proof.id },
      channel_in_app: true,
      channel_email: true
    });
    setImmediate(() => sendPaymentReceivedNotificationEmail(inv.id, notif.id, proof.id, newStatus === INVOICE_STATUS.PAID));
    Object.assign(invoice, await Invoice.findByPk(inv.id, { raw: true }));
  } else {
    const wasVerified = proof.verified_status === 'verified' || (proof.verified_at != null);
    await proof.update({ verified_status: 'rejected', verified_by: null, verified_at: null, notes: notes || proof.notes });
    if (wasVerified) {
      const inv = await Invoice.findByPk(invoice.id);
      await recalcInvoiceFromVerifiedProofs(inv, { changedBy: req.user.id, reason: 'payment_proof_rejected', meta: { payment_proof_id: proof.id } });
      Object.assign(invoice, await Invoice.findByPk(inv.id, { raw: true }));
    }
  }
  const full = await Invoice.findByPk(invoice.id, { include: [{ model: PaymentProof, as: 'PaymentProofs', attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }] });
  res.json({ success: true, data: full });
});

/**
 * PATCH /api/v1/invoices/:id/overpaid
 * Body: { handling: 'refund'|'transfer_invoice'|'transfer_order', target_invoice_id?, target_order_id? }
 */
const handleOverpaid = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (isKoordinatorRole(req.user.role)) {
    const inWilayah = await invoiceInKoordinatorWilayah(invoice, req.user.wilayah_id);
    if (!inWilayah) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
  }
  const overpaid = parseFloat(invoice.overpaid_amount || 0);
  if (overpaid <= 0) return res.status(400).json({ success: false, message: 'Tidak ada overpaid' });
  const { handling, target_invoice_id, target_order_id } = req.body;
  if (!['refund', 'transfer_invoice', 'transfer_order'].includes(handling)) {
    return res.status(400).json({ success: false, message: 'handling harus refund, transfer_invoice, atau transfer_order' });
  }
  await invoice.update({ overpaid_handling: handling, overpaid_amount: 0 });
  if (handling === 'transfer_invoice' && target_invoice_id) {
    const target = await Invoice.findByPk(target_invoice_id);
    if (target && target.owner_id === invoice.owner_id) {
      const newPaid = parseFloat(target.paid_amount) + overpaid;
      const remaining = Math.max(0, parseFloat(target.total_amount) - newPaid);
      await updateInvoiceWithAudit(target, {
        paid_amount: newPaid,
        remaining_amount: remaining,
        status: remaining <= 0 ? INVOICE_STATUS.PAID : target.status
      }, { changedBy: req.user.id, reason: 'overpaid_transfer_in', meta: { source_invoice_id: invoice.id, amount: overpaid } });
    }
  }
  const full = await Invoice.findByPk(invoice.id);
  res.json({ success: true, data: full });
});

/**
 * POST /api/v1/invoices/:id/allocate-balance
 * Owner (atau invoice koordinator): alokasikan saldo ke tagihan invoice.
 * Body: { amount: number }. Mengurangi saldo owner dan menambah paid_amount invoice.
 */
const allocateBalance = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  const canAllocate = isOwnerRole(req.user.role) && invoice.owner_id === req.user.id ||
    ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  if (!canAllocate) return res.status(403).json({ success: false, message: 'Tidak dapat mengalokasikan saldo ke invoice ini' });

  const amount = parseFloat(req.body && req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'amount harus angka positif' });

  const profile = await OwnerProfile.findOne({ where: { user_id: invoice.owner_id } });
  if (!profile) return res.status(400).json({ success: false, message: 'Profil owner tidak ditemukan' });
  const balance = parseFloat(profile.balance) || 0;
  if (balance < amount) return res.status(400).json({ success: false, message: `Saldo tidak cukup. Saldo: Rp ${balance.toLocaleString('id-ID')}, dibutuhkan: Rp ${amount.toLocaleString('id-ID')}` });

  const remaining = parseFloat(invoice.remaining_amount) || 0;
  const allocateAmount = Math.min(amount, remaining);
  if (allocateAmount <= 0) return res.status(400).json({ success: false, message: 'Invoice tidak memiliki sisa tagihan' });

  const newBalance = balance - allocateAmount;
  const newPaid = (parseFloat(invoice.paid_amount) || 0) + allocateAmount;
  const newRemaining = Math.max(0, parseFloat(invoice.total_amount) - newPaid);
  let newStatus = invoice.status;
  if (newRemaining <= 0) newStatus = INVOICE_STATUS.PAID;
  else if (newPaid >= (parseFloat(invoice.dp_amount) || 0)) newStatus = INVOICE_STATUS.PARTIAL_PAID;

  await profile.update({ balance: newBalance });
  await updateInvoiceWithAudit(invoice, { paid_amount: newPaid, remaining_amount: newRemaining, status: newStatus }, { changedBy: req.user.id, reason: 'allocate_balance', meta: { amount: allocateAmount } });
  await OwnerBalanceTransaction.create({
    owner_id: invoice.owner_id,
    amount: -allocateAmount,
    type: 'allocation',
    reference_type: 'invoice',
    reference_id: invoice.id,
    notes: `Alokasi ke invoice ${invoice.invoice_number}. Saldo -${allocateAmount.toLocaleString('id-ID')}`
  });

  const full = await Invoice.findByPk(invoice.id, {
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'owner_id'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }
    ]
  });
  res.json({ success: true, data: full, message: `Saldo Rp ${allocateAmount.toLocaleString('id-ID')} berhasil dialokasikan ke invoice ${invoice.invoice_number}` });
});

/**
 * GET /api/v1/invoices/:id/pdf
 * Unduh invoice dalam format PDF. File disimpan ke disk (local) dan metadata ke DB.
 */
const getPdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id, {
    include: [
      { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] },
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'], order: [['created_at', 'DESC']] },
      { model: PaymentReallocation, as: 'ReallocationsOut', required: false, include: [{ model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number'] }] },
      { model: PaymentReallocation, as: 'ReallocationsIn', required: false, include: [{ model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number'] }] }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (isOwnerRole(req.user.role) && invoice.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  const data = invoice.toJSON();
  const effectiveRates = await getEffectiveKursForInvoice(invoice, invoice.Order);
  data.currency_rates = effectiveRates;
  data.currency_rates_override = effectiveRates;
  const buf = await buildInvoicePdfBuffer(data);

  // Simpan ke disk (local - uploads/invoices/) — setiap request regenerate agar selalu terupdate
  const dir = getDir(SUBDIRS.INVOICES);
  const fileName = invoiceFilename(invoice.invoice_number, invoice.status);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buf, 'binary');

  // Simpan metadata ke database
  const relativePath = path.join(SUBDIRS.INVOICES, fileName).replace(/\\/g, '/');
  await InvoiceFile.upsert({
    invoice_id: invoice.id,
    order_id: invoice.order_id,
    status: invoice.status,
    file_path: relativePath,
    file_name: fileName,
    file_size: buf.length,
    is_example: false,
    generated_by: req.user?.id
  }, { conflictFields: ['invoice_id'] });

  // Format: STATUS INVOICE_NOMOR INVOICE_Nama Owner_Tanggal Order Invoice.pdf (nomor invoice sudah berformat INV-YYYY-xxxxx)
  const statusLabel = getEffectiveStatusLabel(data);
  const safe = (s) => (String(s || '').replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim() || 'invoice');
  const ownerName = (invoice.User && (invoice.User.name || invoice.User.company_name)) || 'Owner';
  const dateOrder = (invoice.issued_at || invoice.created_at) ? new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const downloadName = `${safe(statusLabel)}_${safe(invoice.invoice_number)}_${safe(ownerName)}_${dateOrder}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(buf);
});

/** Normalize rates object to { SAR_TO_IDR, USD_TO_IDR } with defaults. */
function normalizeRates(rates) {
  if (!rates || typeof rates !== 'object') return { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };
  const cr = typeof rates === 'string' ? (() => { try { return JSON.parse(rates); } catch (e) { return null; } })() : rates;
  if (!cr || typeof cr !== 'object') return { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };
  return {
    SAR_TO_IDR: typeof cr.SAR_TO_IDR === 'number' && cr.SAR_TO_IDR > 0 ? cr.SAR_TO_IDR : 4200,
    USD_TO_IDR: typeof cr.USD_TO_IDR === 'number' && cr.USD_TO_IDR > 0 ? cr.USD_TO_IDR : 15500
  };
}

/**
 * Kurs efektif untuk invoice (sync bila currentRules sudah ada):
 * - Jika order punya kurs khusus (form order) → pakai itu.
 * - Jika sudah ada pembayaran → pakai kurs snapshot (kurs saat invoice dibuat).
 * - Jika masih tagihan DP / belum bayar → pakai kurs terbaru dari setting (currentRules).
 */
function getEffectiveKursForInvoiceSync(invoice, order, currentRules) {
  const orderRates = order && order.currency_rates_override && typeof order.currency_rates_override === 'object'
    ? order.currency_rates_override
    : null;
  if (orderRates && (typeof orderRates.SAR_TO_IDR === 'number' || typeof orderRates.USD_TO_IDR === 'number')) {
    return normalizeRates(orderRates);
  }
  const paidAmount = parseFloat(invoice && invoice.paid_amount) || 0;
  const snapshot = invoice && invoice.currency_rates_snapshot && typeof invoice.currency_rates_snapshot === 'object'
    ? invoice.currency_rates_snapshot
    : null;
  if (paidAmount > 0 && snapshot && (typeof snapshot.SAR_TO_IDR === 'number' || typeof snapshot.USD_TO_IDR === 'number')) {
    return normalizeRates(snapshot);
  }
  return normalizeRates(currentRules && currentRules.currency_rates);
}

/**
 * Kurs efektif untuk invoice (async; load rules jika currentRules tidak dikirim).
 */
async function getEffectiveKursForInvoice(invoice, order, currentRules) {
  if (currentRules) return getEffectiveKursForInvoiceSync(invoice, order, currentRules);
  const rules = invoice && invoice.branch_id ? await getRulesForBranch(invoice.branch_id) : await getRulesForBranch(null);
  return getEffectiveKursForInvoiceSync(invoice, order, rules);
}

/**
 * Ambil kurs untuk konversi IDR -> SAR (order.currency_rates_override atau business rules cabang).
 * Return { SAR_TO_IDR, USD_TO_IDR } default 4200/15500.
 */
async function getOrderRatesForConversion(orderId) {
  const ord = await Order.findByPk(orderId, { attributes: ['id', 'branch_id', 'currency_rates_override'] });
  if (!ord) return { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };
  const ov = ord.currency_rates_override && typeof ord.currency_rates_override === 'object' ? ord.currency_rates_override : null;
  if (ov && (typeof ov.SAR_TO_IDR === 'number' || typeof ov.USD_TO_IDR === 'number')) {
    return normalizeRates(ov);
  }
  if (ord.branch_id) {
    try {
      const rules = await getRulesForBranch(ord.branch_id);
      return normalizeRates(rules.currency_rates);
    } catch (e) { /* ignore */ }
  }
  return { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };
}

/**
 * Sinkronkan invoice dengan order setelah order (items/total) berubah.
 * total_amount dari order selalu dalam IDR (frontend kirim unit_price dalam IDR).
 * Simpan total_amount_idr dan total_amount_sar agar form order & list invoice konsisten.
 */
async function syncInvoiceFromOrder(order, opts = {}) {
  const invoice = await Invoice.findOne({ where: { order_id: order.id } });
  if (!invoice) return null;
  const newTotal = parseFloat(order.total_amount) || 0;
  const rates = await getEffectiveKursForInvoice(invoice, order);
  const sarToIdr = rates.SAR_TO_IDR && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const totalAmountIdr = newTotal;
  const totalAmountSar = newTotal / sarToIdr;
  const dpPct = parseInt(invoice.dp_percentage, 10) || 30;
  const dpAmount = Math.round(newTotal * dpPct / 100);
  const paidAmount = parseFloat(invoice.paid_amount) || 0;
  let remainingAmount = newTotal - paidAmount;
  let overpaidAmount = 0;
  if (remainingAmount < 0) {
    overpaidAmount = Math.abs(remainingAmount);
    remainingAmount = 0;
  }
  const hadPayment = paidAmount > 0;
  let newStatus = invoice.status;
  if (remainingAmount <= 0) {
    newStatus = INVOICE_STATUS.PAID;
  } else if (paidAmount >= dpAmount) {
    newStatus = INVOICE_STATUS.PARTIAL_PAID;
  } else if (hadPayment) {
    newStatus = INVOICE_STATUS.PARTIAL_PAID;
  } else {
    newStatus = INVOICE_STATUS.TENTATIVE;
  }
  await updateInvoiceWithAudit(invoice, {
    total_amount: newTotal,
    total_amount_idr: totalAmountIdr,
    total_amount_sar: totalAmountSar,
    dp_amount: dpAmount,
    remaining_amount: remainingAmount,
    overpaid_amount: overpaidAmount,
    status: newStatus,
    ...(opts.order_updated_at ? { order_updated_at: opts.order_updated_at } : {}),
    ...(opts.last_order_revision_id ? { last_order_revision_id: opts.last_order_revision_id } : {})
  }, {
    changedBy: opts.changed_by || null,
    reason: opts.reason || 'sync_from_order',
    meta: opts.meta || null
  });
  const invReload = await Invoice.findByPk(invoice.id, { attributes: ['id', 'order_id', 'total_amount', 'paid_amount', 'dp_amount', 'status'] });
  if (invReload) {
    await updateOrderDpStatusFromInvoice(invReload);
    const ord = await Order.findByPk(invoice.order_id, { attributes: ['id'] });
    if (ord) {
      const upd = {
        total_amount_idr: totalAmountIdr,
        total_amount_sar: totalAmountSar
      };
      if (opts.order_updated_at) upd.order_updated_at = opts.order_updated_at;
      await ord.update(upd);
    }
  }
  return invoice;
}

/**
 * Jumlah yang bisa dialihkan dari invoice: canceled = paid_amount; else overpaid_amount.
 */
function getReleasableAmount(invoice) {
  const status = (invoice.status || '').toLowerCase();
  const paid = parseFloat(invoice.paid_amount) || 0;
  const overpaid = parseFloat(invoice.overpaid_amount) || 0;
  if (status === 'canceled' || status === 'cancelled' || status === INVOICE_STATUS.CANCELLED_REFUND) return Math.max(0, paid);
  return Math.max(0, overpaid);
}

/**
 * Cek apakah user boleh mengakses invoice untuk reallocation (sumber atau target).
 */
async function canAccessInvoiceForReallocation(invoiceId, user) {
  const invoice = await Invoice.findByPk(invoiceId, { attributes: ['id', 'owner_id', 'branch_id'] });
  if (!invoice) return { ok: false, message: 'Invoice tidak ditemukan' };
  if (isOwnerRole(user.role) && invoice.owner_id !== user.id) return { ok: false, message: 'Bukan invoice Anda' };
  if (isKoordinatorRole(user.role)) {
    const inWilayah = await invoiceInKoordinatorWilayah(invoice, user.wilayah_id);
    if (!inWilayah) return { ok: false, message: 'Invoice bukan di wilayah Anda' };
  }
  if (user.branch_id && !isOwnerRole(user.role) && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_koordinator', 'invoice_saudi'].includes(user.role) && !isKoordinatorRole(user.role)) {
    if (invoice.branch_id !== user.branch_id) return { ok: false, message: 'Invoice bukan di cabang Anda' };
  }
  return { ok: true, invoice };
}

/**
 * POST /api/v1/invoices/reallocate-payments
 * Body: { transfers: [ { source_invoice_id, target_invoice_id, amount }, ... ], notes? }
 * Pemindahan dana dari invoice sumber (canceled/overpaid) ke invoice penerima. Bisa banyak sumber -> banyak penerima.
 */
const reallocatePayments = asyncHandler(async (req, res) => {
  const allowed = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Hanya owner atau role invoice yang dapat memindahkan dana' });
  }
  const transfers = req.body?.transfers;
  if (!Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ success: false, message: 'Body harus berisi array transfers: [{ source_invoice_id, target_invoice_id, amount }]' });
  }

  const parsed = [];
  for (const t of transfers) {
    const amount = parseFloat(t?.amount);
    if (!t?.source_invoice_id || !t?.target_invoice_id || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Setiap transfer wajib: source_invoice_id, target_invoice_id, amount (angka positif)' });
    }
    if (t.source_invoice_id === t.target_invoice_id) {
      return res.status(400).json({ success: false, message: 'Invoice sumber dan penerima tidak boleh sama' });
    }
    parsed.push({ source_invoice_id: t.source_invoice_id, target_invoice_id: t.target_invoice_id, amount });
  }

  const sourceIds = [...new Set(parsed.map(p => p.source_invoice_id))];
  const targetIds = [...new Set(parsed.map(p => p.target_invoice_id))];
  const allInvoiceIds = [...new Set([...sourceIds, ...targetIds])];
  const invoices = await Invoice.findAll({ where: { id: { [Op.in]: allInvoiceIds } }, raw: true });
  const invoiceMap = new Map(invoices.map(i => [i.id, i]));

  for (const id of allInvoiceIds) {
    const access = await canAccessInvoiceForReallocation(id, req.user);
    if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  }

  const sourceTotalByInvoice = {};
  for (const p of parsed) {
    sourceTotalByInvoice[p.source_invoice_id] = (sourceTotalByInvoice[p.source_invoice_id] || 0) + p.amount;
  }
  for (const [invId, totalDeduct] of Object.entries(sourceTotalByInvoice)) {
    const inv = invoiceMap.get(invId);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice sumber tidak ditemukan' });
    const releasable = getReleasableAmount(inv);
    if (totalDeduct > releasable) {
      return res.status(400).json({
        success: false,
        message: `Invoice ${inv.invoice_number} hanya dapat dialihkan maksimal Rp ${releasable.toLocaleString('id-ID')}. Requested: Rp ${totalDeduct.toLocaleString('id-ID')}`
      });
    }
  }

  for (const p of parsed) {
    const target = invoiceMap.get(p.target_invoice_id);
    if (!target) return res.status(404).json({ success: false, message: 'Invoice penerima tidak ditemukan' });
    const status = (target.status || '').toLowerCase();
    if (status === 'canceled' || status === 'cancelled' || status === INVOICE_STATUS.CANCELLED_REFUND) {
      return res.status(400).json({ success: false, message: `Invoice penerima ${target.invoice_number} dalam status dibatalkan` });
    }
  }

  const notes = (req.body?.notes && String(req.body.notes).trim()) || null;

  await sequelize.transaction(async (tx) => {
    const sourceDeduct = {};
    for (const p of parsed) {
      sourceDeduct[p.source_invoice_id] = (sourceDeduct[p.source_invoice_id] || 0) + p.amount;
    }
    for (const [invId, deduct] of Object.entries(sourceDeduct)) {
      const inv = await Invoice.findByPk(invId, { transaction: tx });
      const paid = parseFloat(inv.paid_amount) || 0;
      const overpaid = parseFloat(inv.overpaid_amount) || 0;
      const totalAmount = parseFloat(inv.total_amount) || 0;
      const isCanceled = (inv.status || '').toLowerCase() === 'canceled' || (inv.status || '').toLowerCase() === 'cancelled' || inv.status === INVOICE_STATUS.CANCELLED_REFUND;
      let newPaid = paid - deduct;
      let newOverpaid = overpaid;
      if (isCanceled) {
        newPaid = Math.max(0, paid - deduct);
      } else {
        const fromOverpaid = Math.min(deduct, overpaid);
        const fromPaid = deduct - fromOverpaid;
        newOverpaid = Math.max(0, overpaid - fromOverpaid);
        newPaid = Math.max(0, paid - fromPaid);
      }
      const newRemaining = Math.max(0, totalAmount - newPaid);
      let newStatus = inv.status;
      if (newRemaining <= 0) newStatus = INVOICE_STATUS.PAID;
      else if (newPaid >= (parseFloat(inv.dp_amount) || 0)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      else newStatus = INVOICE_STATUS.TENTATIVE;
      await updateInvoiceWithAudit(inv, {
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        overpaid_amount: newOverpaid,
        status: newStatus
      }, { changedBy: req.user.id, reason: 'reallocate_out', meta: { amount: deduct, notes, is_canceled: isCanceled }, transaction: tx });
    }

    const targetAdd = {};
    for (const p of parsed) {
      targetAdd[p.target_invoice_id] = (targetAdd[p.target_invoice_id] || 0) + p.amount;
    }
    for (const [invId, add] of Object.entries(targetAdd)) {
      const inv = await Invoice.findByPk(invId, { transaction: tx });
      const paid = parseFloat(inv.paid_amount) || 0;
      const totalAmount = parseFloat(inv.total_amount) || 0;
      const newPaid = paid + add;
      const newRemaining = Math.max(0, totalAmount - newPaid);
      let newStatus = inv.status;
      if (newRemaining <= 0) newStatus = INVOICE_STATUS.PAID;
      else if (newPaid >= (parseFloat(inv.dp_amount) || 0)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      await updateInvoiceWithAudit(inv, {
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        status: newStatus
      }, { changedBy: req.user.id, reason: 'reallocate_in', meta: { amount: add, notes }, transaction: tx });
    }

    for (const p of parsed) {
      await PaymentReallocation.create({
        source_invoice_id: p.source_invoice_id,
        target_invoice_id: p.target_invoice_id,
        amount: p.amount,
        performed_by: req.user.id,
        notes
      }, { transaction: tx });
    }
  });

  const totalAmount = parsed.reduce((s, p) => s + p.amount, 0);
  res.json({
    success: true,
    message: `Pemindahan dana Rp ${totalAmount.toLocaleString('id-ID')} berhasil (${parsed.length} alokasi).`,
    data: { transfers: parsed.length, total_amount: totalAmount }
  });
});

/**
 * GET /api/v1/invoices/reallocations
 * Query: invoice_id (optional, filter sebagai sumber atau target), limit, page
 */
const listReallocations = asyncHandler(async (req, res) => {
  const allowed = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang melihat riwayat pemindahan dana' });
  }
  const { invoice_id, limit = 50, page = 1 } = req.query;
  const where = {};
  if (invoice_id) {
    where[Op.or] = [{ source_invoice_id: invoice_id }, { target_invoice_id: invoice_id }];
  }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  if (invoice_id && isOwnerRole(req.user.role)) {
    const inv = await Invoice.findByPk(invoice_id, { attributes: ['id', 'owner_id'] });
    if (!inv || inv.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Invoice bukan milik Anda' });
    }
  }
  if (invoice_id && isKoordinatorRole(req.user.role)) {
    const inv = await Invoice.findByPk(invoice_id, { attributes: ['id', 'branch_id'] });
    if (inv) {
      const inWilayah = await invoiceInKoordinatorWilayah(inv, req.user.wilayah_id);
      if (!inWilayah) {
        return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
      }
    }
  }

  const { count, rows } = await PaymentReallocation.findAndCountAll({
    where,
    limit: lim,
    offset,
    order: [['created_at', 'DESC']],
    include: [
      { model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number', 'order_id'], required: false },
      { model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number', 'order_id'], required: false },
      { model: User, as: 'PerformedBy', attributes: ['id', 'name', 'email'], required: false }
    ]
  });

  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page: pg, limit: lim, totalPages: Math.ceil(count / lim) }
  });
});

/**
 * GET /api/v1/invoices/:id/releasable
 * Mengembalikan jumlah yang bisa dialihkan dari invoice ini (untuk UI).
 */
const getReleasable = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id, { attributes: ['id', 'invoice_number', 'status', 'paid_amount', 'overpaid_amount', 'owner_id', 'branch_id'] });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  const access = await canAccessInvoiceForReallocation(invoice.id, req.user);
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const allowed = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang' });
  }
  const releasable = getReleasableAmount(invoice);
  res.json({ success: true, data: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, releasable_amount: releasable } });
});

/**
 * GET /api/v1/invoices/:id/status-history
 * Hanya kembalikan entri di mana status benar-benar berubah (from_status !== to_status).
 * Entri duplikat seperti "Pembayaran DP → Pembayaran DP" dari sync form order tidak ditampilkan.
 */
const getStatusHistory = asyncHandler(async (req, res) => {
  const access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const rows = await InvoiceStatusHistory.findAll({
    where: { invoice_id: req.params.id },
    order: [['changed_at', 'ASC']],
    include: [{ model: User, as: 'ChangedBy', attributes: ['id', 'name', 'email'], required: false }]
  });
  const filtered = rows.filter((r) => String(r.from_status || '') !== String(r.to_status || ''));
  res.json({ success: true, data: filtered });
});

/**
 * GET /api/v1/invoices/:id/order-revisions
 */
const getOrderRevisions = asyncHandler(async (req, res) => {
  const access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const rows = await OrderRevision.findAll({
    where: { invoice_id: req.params.id },
    order: [['revision_no', 'DESC']],
    include: [{ model: User, as: 'ChangedBy', attributes: ['id', 'name', 'email'], required: false }]
  });
  res.json({ success: true, data: rows });
});

module.exports = {
  list,
  listDraftOrders,
  getSummary,
  create,
  createInvoiceForOrder,
  getById,
  getPdf,
  unblock,
  verifyPayment,
  handleOverpaid,
  allocateBalance,
  ensureBlockedStatus,
  syncInvoiceFromOrder,
  reallocatePayments,
  listReallocations,
  getReleasable,
  getStatusHistory,
  getOrderRevisions,
  sendPaymentReceivedNotificationEmail
};
