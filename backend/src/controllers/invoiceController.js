const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const asyncHandler = require('express-async-handler');
const sequelize = require('../config/sequelize');
const { Invoice, InvoiceFile, Order, OrderItem, User, Branch, PaymentProof, Notification, Provinsi, Wilayah, Product, VisaProgress, TicketProgress, HotelProgress, BusProgress, Refund, OwnerProfile, OwnerBalanceTransaction, PaymentReallocation, AccountingBankAccount, Bank, InvoiceStatusHistory, OrderRevision } = require('../models');
const { INVOICE_STATUS, NOTIFICATION_TRIGGER, ORDER_ITEM_TYPE, DP_PAYMENT_STATUS, REFUND_SOURCE, isOwnerRole, ROLES } = require('../constants');
const { getRulesForBranch } = require('./businessRuleController');
const { getBranchIdsForWilayah, invoiceInKoordinatorWilayah } = require('../utils/wilayahScope');
const { enrichBranchWithLocation } = require('../utils/locationMaster');
const { resolveBankAccountsForInvoice } = require('../utils/invoiceBankAccounts');

const KOORDINATOR_ROLES = ['invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'];
function isKoordinatorRole(role) {
  return KOORDINATOR_ROLES.includes(role);
}

/** Satu baris alokasi saldo → payload API (amount selalu positif IDR). */
function mapBalanceAllocRow(r) {
  return {
    id: r.id,
    amount: Math.abs(Math.min(0, parseFloat(r.amount) || 0)),
    notes: r.notes || null,
    created_at: r.created_at
  };
}

/** Alokasi saldo per invoice untuk PDF / email (sama bentuk dengan BalanceAllocations di API). */
async function loadBalanceAllocationsForInvoicePdf(invoiceId) {
  const rows = await OwnerBalanceTransaction.findAll({
    where: { reference_type: 'invoice', reference_id: invoiceId, type: 'allocation' },
    attributes: ['id', 'amount', 'notes', 'created_at'],
    order: [['created_at', 'ASC']],
    raw: true
  });
  return rows.map(mapBalanceAllocRow);
}

/**
 * Jatuh tempo DP & batas auto-block: dari waktu order dibuat + jam (bukan hari kalender).
 * Pakai aturan `dp_grace_hours` (default 24).
 */
function computeDpDeadlineFromOrder(order, graceHours) {
  const h = Math.max(1, parseInt(graceHours, 10) || 24);
  const base = order && order.created_at != null ? new Date(order.created_at) : new Date();
  return new Date(base.getTime() + h * 60 * 60 * 1000);
}

/** Atribut PaymentProof untuk include (tanpa proof_file_name, proof_file_content_type, proof_file_data agar kompatibel dengan DB yang belum punya kolom tersebut; setelah migration 20260327000001 jalan, bisa tambah proof_file_name) */
const PAYMENT_PROOF_ATTRS = ['id', 'invoice_id', 'payment_type', 'amount', 'payment_currency', 'amount_original', 'amount_idr', 'amount_sar', 'bank_id', 'bank_name', 'account_number', 'sender_account_name', 'sender_account_number', 'recipient_bank_account_id', 'transfer_date', 'proof_file_url', 'uploaded_by', 'verified_by', 'verified_at', 'verified_status', 'notes', 'issued_by', 'payment_location', 'reconciled_at', 'reconciled_by', 'created_at', 'updated_at'];
const archiver = require('archiver');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { drawCorporateLetterhead } = require('../utils/pdfLetterhead');
const { buildInvoicePdfBuffer, getEffectiveStatusLabel, getFirstInvoiceLineDescriptionForFilename } = require('../utils/invoicePdf');
const { buildHotelInfoPdfBuffer } = require('../utils/hotelPdf');
const { buildVisaSlipPdfBuffer } = require('../utils/visaSlipPdf');
const { buildTicketSlipPdfBuffer } = require('../utils/ticketSlipPdf');
const { buildBusSlipPdfBuffer } = require('../utils/busSlipPdf');
const { SUBDIRS, getDir, UPLOAD_ROOT, invoiceFilename, toUrlPath } = require('../config/uploads');
const uploadConfig = require('../config/uploads');
const { sendInvoiceCreatedEmail, sendPaymentReceivedEmail } = require('../utils/emailService');
const logger = require('../config/logger');

/** Isi data.bank_accounts untuk PDF / email (sama logika dengan GET invoice). */
async function attachResolvedBankAccountsForPdf(data, invoice) {
  try {
    const rules = await getRulesForBranch(invoice.branch_id);
    const accountingBankAccounts = await AccountingBankAccount.findAll({
      where: { is_active: true },
      order: [['bank_name', 'ASC'], ['account_number', 'ASC']],
      attributes: ['id', 'code', 'name', 'bank_name', 'account_number', 'currency']
    });
    const rulesBankAccounts = Array.isArray(rules.bank_accounts)
      ? rules.bank_accounts
      : (typeof rules.bank_accounts === 'string'
        ? (() => { try { return JSON.parse(rules.bank_accounts); } catch (e) { return []; } })()
        : []);
    data.bank_accounts = resolveBankAccountsForInvoice(data.Order, accountingBankAccounts, rulesBankAccounts, {
      paid_amount: parseFloat(data.paid_amount) || 0,
      remaining_amount: parseFloat(data.remaining_amount) || 0
    });
  } catch (e) {
    logger.error('attachResolvedBankAccountsForPdf: ' + (e.message || String(e)));
    data.bank_accounts = [];
  }
}

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
        { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type', 'meta'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
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
    data.BalanceAllocations = await loadBalanceAllocationsForInvoicePdf(invoice.id);
    await attachResolvedBankAccountsForPdf(data, invoice);
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
        { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type', 'meta'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
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
    data.BalanceAllocations = await loadBalanceAllocationsForInvoicePdf(invoice.id);
    await attachResolvedBankAccountsForPdf(data, invoice);
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
 * Total IDR yang masuk ke invoice lewat alokasi saldo owner (POST .../allocate-balance).
 * Di owner_balance_transactions: type=allocation, amount negatif = saldo owner berkurang = pembayaran ke invoice.
 */
async function sumBalanceAllocationsToInvoice(invoiceId, { transaction } = {}) {
  const raw = await OwnerBalanceTransaction.sum('amount', {
    where: {
      reference_type: 'invoice',
      reference_id: invoiceId,
      type: 'allocation'
    },
    transaction
  });
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n >= 0) return 0;
  return Math.abs(n);
}

/**
 * Hitung ulang paid_amount dan status invoice dari bukti bayar terverifikasi + alokasi saldo ke invoice.
 * Pembayaran KES (payment_location = saudi) selalu dianggap terverifikasi, tidak perlu konfirmasi admin.
 */
async function recalcInvoiceFromVerifiedProofs(invoice, { changedBy, reason, meta, transaction } = {}) {
  const proofs = await PaymentProof.findAll({
    where: {
      invoice_id: invoice.id,
      [Op.or]: [
        { verified_status: 'verified' },
        { payment_location: 'saudi' }
      ]
    },
    attributes: PAYMENT_PROOF_ATTRS,
    transaction
  });
  const verifiedSum = proofs.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const allocSum = await sumBalanceAllocationsToInvoice(invoice.id, { transaction });
  const newPaid = verifiedSum + allocSum;
  const total = parseFloat(invoice.total_amount) || 0;
  const dpAmount = parseFloat(invoice.dp_amount) || 0;
  const remaining = Math.max(0, total - newPaid);
  let newStatus;
  if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
  else if (dpAmount > 0 && newPaid >= dpAmount) newStatus = INVOICE_STATUS.PARTIAL_PAID; // Pembayaran DP (DP terpenuhi)
  else if (newPaid > 0) newStatus = INVOICE_STATUS.PARTIAL_PAID; // Ada pembayaran (bukti dan/atau saldo)
  else newStatus = INVOICE_STATUS.TENTATIVE; // Tagihan DP
  await updateInvoiceWithAudit(invoice, {
    paid_amount: newPaid,
    remaining_amount: remaining,
    status: newStatus
  }, { changedBy, reason: reason || 'recalc_from_verified_proofs', meta: { ...(meta || {}), verified_sum: verifiedSum, balance_allocation_sum: allocSum }, transaction });
  const invReload = await Invoice.findByPk(invoice.id, { attributes: ['id', 'order_id', 'total_amount', 'paid_amount', 'dp_amount', 'status'], transaction });
  if (invReload) await updateOrderDpStatusFromInvoice(invReload);
  return { verifiedSum, allocSum, combinedPaid: newPaid, remaining, newStatus };
}

/**
 * GET /api/v1/invoices
 * Sumber utama daftar transaksi: semua GET yang menampilkan order/invoice terintegrasi dengan data invoice ini.
 * Dashboard, report, accounting, dan divisi (hotel/visa/ticket/bus) mengacu data dari invoice.
 */
const ALLOWED_SORT = ['invoice_number', 'created_at', 'total_amount', 'status'];

async function resolveBranchFilterList(branch_id, provinsi_id, wilayah_id, user) {
  if (!user) return branch_id ? { branch_id } : {};
  // Role hotel, bus, handling, siskopatuh: lihat semua wilayah (tidak batasi by branch/wilayah)
  if (user.role === 'role_hotel' || user.role === 'role_bus' || user.role === 'handling' || user.role === 'role_siskopatuh') return {};
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
    const ids = await getBranchIdsForWilayah(wilayah_id);
    return ids.length ? { branch_id: { [Op.in]: ids } } : { branch_id: { [Op.in]: [] } };
  }
  return {};
}

function serializeInvoiceRows(rows) {
  return rows.map((row) => {
    const plain = row.get ? row.get({ plain: true }) : (typeof row.toJSON === 'function' ? row.toJSON() : row);
    if (plain.Order && !Array.isArray(plain.Order.OrderItems)) plain.Order.OrderItems = [];
    plain.owner_is_mou = !!(plain.User && plain.User.OwnerProfile && plain.User.OwnerProfile.is_mou_owner);
    return plain;
  });
}

/** Relasi tambahan untuk daftar invoice (sama dengan GET /invoices, tanpa heal paid_amount). */
async function loadInvoiceListRelations(data) {
  const orderIdsFromRows = [...new Set(data.map((d) => d.order_id).filter(Boolean))];
  let orderItemsByOrderId = {};
  if (orderIdsFromRows.length > 0) {
    const items = await OrderItem.findAll({
      where: { order_id: orderIdsFromRows, type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.SISKOPATUH, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
      include: [
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type', 'meta'], required: false },
        { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
        { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
        { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
        { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
      ],
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'unit_price', 'unit_price_currency', 'manifest_file_url', 'meta', 'jamaah_data_type', 'jamaah_data_value']
    });
    for (const it of items) {
      const oid = it.order_id;
      if (!orderItemsByOrderId[oid]) orderItemsByOrderId[oid] = [];
      const plain = it.get ? it.get({ plain: true }) : it;
      plain.product_name = (plain.Product && plain.Product.name) ? plain.Product.name : null;
      // Kompatibilitas lintas skema lama/baru: gunakan unit_price_currency sebagai currency item.
      plain.currency = plain.currency || plain.unit_price_currency || 'IDR';
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
    const balAllocList = await OwnerBalanceTransaction.findAll({
      where: { reference_type: 'invoice', reference_id: { [Op.in]: invoiceIds }, type: 'allocation' },
      attributes: ['id', 'reference_id', 'amount', 'notes', 'created_at'],
      order: [['created_at', 'ASC']],
      raw: true
    });
    const balByInvId = balAllocList.reduce((acc, r) => {
      const invId = r.reference_id;
      if (!acc[invId]) acc[invId] = [];
      acc[invId].push(mapBalanceAllocRow(r));
      return acc;
    }, {});
    for (const d of data) {
      d.BalanceAllocations = balByInvId[d.id] || [];
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

  await Promise.all(data.map(async (d) => {
    if (!d.Branch || (!d.Branch.code && !d.Branch.provinsi_id)) return;
    try {
      const loc = await enrichBranchWithLocation(d.Branch, { syncDb: false });
      d.Branch.provinsi_name = loc.provinsi_name ?? d.Branch.provinsi_name;
      d.Branch.wilayah_name = loc.wilayah_name ?? d.Branch.wilayah_name;
      d.Branch.provinsi_id = loc.provinsi_id ?? d.Branch.provinsi_id;
      d.Branch.wilayah_id = loc.wilayah_id ?? d.Branch.wilayah_id;
    } catch (_) { /* non-fatal */ }
  }));
}

/**
 * Filter & include sama dengan GET /invoices (untuk list & export).
 * @returns {{ where: object, orderInclude: object, orderBy: any[] }}
 */
async function buildInvoiceListFilters(req) {
  const { status, branch_id, provinsi_id, wilayah_id, owner_id, order_status, invoice_number, date_from, date_to, due_status, has_handling, sort_by, sort_order } = req.query;
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
  const divisiProgressRoles = ['role_hotel', 'role_bus', 'handling', 'role_siskopatuh', 'visa_koordinator', 'tiket_koordinator'];
  if (divisiProgressRoles.includes(req.user.role)) {
    let orderIdsByType = [];
    if (req.user.role === 'role_hotel') {
      const hotelRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HOTEL }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((hotelRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_bus') {
      const [busRows, visaRows] = await Promise.all([
        OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true }),
        OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true })
      ]);
      const orderIdsFromBus = [...new Set((busRows || []).map((r) => r.order_id))];
      const orderIdsFromVisaRaw = [...new Set((visaRows || []).map((r) => r.order_id))];
      const visaOnlyOrders = orderIdsFromVisaRaw.length
        ? await Order.findAll({
          where: { id: { [Op.in]: orderIdsFromVisaRaw }, bus_service_option: 'visa_only' },
          attributes: ['id'],
          raw: true
        })
        : [];
      const visaOnlySet = new Set((visaOnlyOrders || []).map((o) => o.id));
      const orderIdsFromVisa = orderIdsFromVisaRaw.filter((oid) => !visaOnlySet.has(oid));
      const waiveOrders = await Order.findAll({ where: { waive_bus_penalty: true }, attributes: ['id'], raw: true });
      const orderIdsWaive = (waiveOrders || []).map((o) => o.id);
      orderIdsByType = [...new Set([...orderIdsFromBus, ...orderIdsFromVisa, ...orderIdsWaive])];
    } else if (req.user.role === 'handling') {
      const handlingRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HANDLING }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((handlingRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_siskopatuh') {
      const siskRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.SISKOPATUH }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((siskRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'visa_koordinator') {
      const visaRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((visaRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'tiket_koordinator') {
      const ticketRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.TICKET }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((ticketRows || []).map((r) => r.order_id))];
    }
    where.order_id = orderIdsByType.length ? { [Op.in]: orderIdsByType } : { [Op.in]: [] };
  }
  if (req.user.branch_id && !isOwnerRole(req.user.role) && req.user.role !== 'role_hotel' && req.user.role !== 'role_bus' && req.user.role !== 'handling' && req.user.role !== 'role_siskopatuh' && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }

  const orderInclude = {
    model: Order,
    as: 'Order',
    attributes: [
      'id', 'order_number', 'total_amount', 'currency', 'status', 'created_at', 'currency_rates_override', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at', 'total_amount_idr', 'total_amount_sar', 'penalty_amount', 'waive_bus_penalty', 'bus_service_option',
      'bus_include_arrival_status', 'bus_include_arrival_bus_number', 'bus_include_arrival_date', 'bus_include_arrival_time',
      'bus_include_return_status', 'bus_include_return_bus_number', 'bus_include_return_date', 'bus_include_return_time'
    ],
    include: [
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.SISKOPATUH, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
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

  const orderIdsParam = req.query.order_ids;
  if (orderIdsParam != null && String(orderIdsParam).trim() !== '') {
    const requested = String(orderIdsParam).split(',').map((s) => s.trim()).filter(Boolean);
    if (requested.length > 0) {
      if (where.order_id == null) {
        where.order_id = { [Op.in]: requested };
      } else if (typeof where.order_id === 'object' && where.order_id[Op.in]) {
        const allowed = new Set(where.order_id[Op.in]);
        const inter = requested.filter((id) => allowed.has(id));
        where.order_id = inter.length ? { [Op.in]: inter } : { [Op.in]: [] };
      } else {
        const single = where.order_id;
        where.order_id = requested.includes(single) ? single : { [Op.in]: [] };
      }
    }
  }

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderBy = [[sortCol, sortDir]];
  return { where, orderInclude, orderBy };
}

function getInvoiceListRates(inv) {
  const ov = (inv.Order && inv.Order.currency_rates_override) || {};
  const sarToIdr = parseFloat(ov.SAR_TO_IDR) || 4200;
  const usdToIdr = parseFloat(ov.USD_TO_IDR) || 15500;
  return { sarToIdr, usdToIdr };
}

function invoiceListAmountTriple(inv) {
  const { sarToIdr, usdToIdr } = getInvoiceListRates(inv);
  const st = (inv.status || '').toLowerCase();
  const cancelledNoPay = (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund') && (parseFloat(inv.paid_amount || 0) <= 0);
  if (cancelledNoPay) return { idr: 0, sar: 0, usd: 0, sarToIdr, usdToIdr };
  const idr = inv.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv.total_amount || 0);
  const sar = inv.total_amount_sar != null ? parseFloat(inv.total_amount_sar) : idr / sarToIdr;
  const usd = idr / usdToIdr;
  return { idr, sar, usd, sarToIdr, usdToIdr };
}

function paidTripleForList(inv) {
  const paid = parseFloat(inv.paid_amount || 0);
  const { sarToIdr, usdToIdr } = getInvoiceListRates(inv);
  return { idr: paid, sar: paid / sarToIdr, usd: paid / usdToIdr };
}

function remainingTripleForList(inv) {
  const rem = parseFloat(inv.remaining_amount || 0);
  const { sarToIdr, usdToIdr } = getInvoiceListRates(inv);
  return { idr: rem, sar: rem / sarToIdr, usd: rem / usdToIdr };
}

function summarizeRefundsForExport(inv) {
  const list = inv.Refunds || [];
  if (!list.length) return '-';
  return list.map((r) => `${r.status || '?'}:${Number(r.amount || 0).toLocaleString('id-ID')}`).join('; ');
}

function summarizeBalanceAllocForExport(inv) {
  const list = inv.BalanceAllocations || [];
  if (!list.length) return '-';
  const sum = list.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  return `Rp ${sum.toLocaleString('id-ID')} (${list.length} trx)`;
}

function summarizeReallocForExport(inv) {
  const out = (inv.ReallocationsOut || []).map((r) => `→${r.TargetInvoice?.invoice_number || '?'}:${Number(r.amount || 0).toLocaleString('id-ID')}`);
  const inn = (inv.ReallocationsIn || []).map((r) => `←${r.SourceInvoice?.invoice_number || '?'}:${Number(r.amount || 0).toLocaleString('id-ID')}`);
  const parts = [...out, ...inn];
  return parts.length ? parts.join('; ') : '-';
}

function getInvoiceStatusLabelForExport(inv) {
  try {
    const labeled = getEffectiveStatusLabel(inv);
    if (typeof labeled === 'string' && labeled.trim()) return labeled;
  } catch (_) { /* fallback */ }
  return inv.status || '-';
}

function getOrderItemStatusForExport(item) {
  const t = String(item?.type || '').toLowerCase();
  if (t === ORDER_ITEM_TYPE.VISA) return item?.VisaProgress?.status || 'belum diproses';
  if (t === ORDER_ITEM_TYPE.TICKET) return item?.TicketProgress?.status || 'belum diproses';
  if (t === ORDER_ITEM_TYPE.HOTEL) return item?.HotelProgress?.status || 'belum diproses';
  if (t === ORDER_ITEM_TYPE.BUS) {
    const p = item?.BusProgress || {};
    const parts = [p.bus_ticket_status, p.arrival_status, p.departure_status, p.return_status].filter(Boolean);
    return parts.length ? parts.join('/') : 'belum diproses';
  }
  if (t === ORDER_ITEM_TYPE.SISKOPATUH || t === ORDER_ITEM_TYPE.HANDLING || t === ORDER_ITEM_TYPE.PACKAGE) {
    return (item?.meta && item.meta.status) ? String(item.meta.status) : 'sesuai progress invoice';
  }
  return 'belum diproses';
}

function summarizeOrderItemsForExport(inv) {
  const items = inv?.Order?.OrderItems || [];
  if (!items.length) return '-';
  return items
    .map((it) => `${String(it.type || '-').toUpperCase()}:${it.product_name || it.Product?.name || '-'} x${parseInt(it.quantity, 10) || 0}`)
    .join(' | ');
}

function orderItemQtyUnitForExport(item) {
  const t = String(item?.type || '').toLowerCase();
  if (t === ORDER_ITEM_TYPE.HOTEL) {
    const mode = String(item?.Product?.meta?.room_pricing_mode || '').toLowerCase();
    return mode === 'per_person' ? 'pack' : 'room';
  }
  return 'qty';
}

function getNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(String(checkIn).slice(0, 10));
  const b = new Date(String(checkOut).slice(0, 10));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDateTimeJakartaForExport(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}.${get('minute')}.${get('second')}`;
}

function formatDateOnlyForExport(value) {
  if (!value) return '-';
  const d = new Date(String(value).slice(0, 10));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function formatMoneyForExport(amount, currency = 'IDR') {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return `${currency || 'IDR'} 0`;
  if (String(currency || 'IDR').toUpperCase() === 'IDR') {
    return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
  }
  return `${String(currency || 'IDR').toUpperCase()} ${n.toFixed(2)}`;
}

function amountTripleForDisplay(amount, fromCurrency, sarToIdr = 4200, usdToIdr = 15500) {
  const cur = String(fromCurrency || 'IDR').toUpperCase();
  const raw = Number(amount || 0);
  const idr = cur === 'IDR' ? raw : cur === 'SAR' ? raw * sarToIdr : raw * usdToIdr;
  const sar = sarToIdr > 0 ? idr / sarToIdr : 0;
  const usd = usdToIdr > 0 ? idr / usdToIdr : 0;
  return { idr, sar, usd };
}

function buildPaymentHistoryLines(inv) {
  const lines = [];
  const proofs = Array.isArray(inv?.PaymentProofs) ? inv.PaymentProofs : [];
  proofs
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime())
    .forEach((p) => {
      const dt = formatDateTimeJakartaForExport(p?.transfer_date || p?.created_at);
      const method = String(p?.payment_type || 'transfer').toUpperCase();
      const status = String(p?.verified_status || 'pending').toUpperCase();
      const currency = String(p?.payment_currency || 'IDR').toUpperCase();
      const amt = Number(p?.amount_original ?? p?.amount ?? p?.amount_idr ?? 0);
      const bankSender = p?.bank_name || p?.Bank?.name || '-';
      const bankRecipient = p?.RecipientAccount?.bank_name || '-';
      const recipientAccNo = p?.RecipientAccount?.account_number || '-';
      const sender = p?.sender_account_name || '-';
      lines.push({
        info1: `${dt} | ${method} | ${status}`,
        info2: `${formatMoneyForExport(amt, currency)} | Pengirim: ${sender} (${bankSender})`,
        info3: `Penerima: ${bankRecipient} ${recipientAccNo}`
      });
    });
  const allocs = Array.isArray(inv?.BalanceAllocations) ? inv.BalanceAllocations : [];
  allocs.forEach((a) => {
    const dt = formatDateTimeJakartaForExport(a?.created_at);
    const amt = Number(a?.amount || 0);
    lines.push({
      info1: `${dt} | ALOKASI SALDO | VERIFIED`,
      info2: `${formatMoneyForExport(amt, 'IDR')}`,
      info3: 'Penerima: -'
    });
  });
  if (!lines.length) lines.push({ info1: '-', info2: '', info3: '' });
  return lines;
}

function buildPdfOrderItemsDetailed(inv) {
  const src = inv?.Order?.OrderItems || [];
  if (!src.length) return [];
  const grouped = new Map();
  for (const it of src) {
    const type = String(it?.type || '-').toLowerCase();
    const typeLabel = type.toUpperCase();
    const productNameRaw = (it?.product_name || it?.Product?.name || '-');
    const unit = orderItemQtyUnitForExport(it);
    const qty = Math.max(0, parseInt(it?.quantity, 10) || 0);
    const currency = String(it?.currency || 'IDR').toUpperCase();
    const unitPriceRaw = Number(it?.unit_price || it?.meta?.room_unit_price || 0);
    const mealUnitPriceRaw = Number(it?.meta?.meal_unit_price || 0);
    const unitPrice = unitPriceRaw + mealUnitPriceRaw;
    const checkIn = it?.check_in || it?.meta?.check_in || it?.HotelProgress?.check_in_date;
    const checkOut = it?.check_out || it?.meta?.check_out || it?.HotelProgress?.check_out_date;
    const location = String(it?.meta?.hotel_location || '').trim();
    const roomTypeRaw = String(it?.meta?.room_type || it?.meta?.hotel_room_type || '').trim();
    const hotelNameFromMeta = String(it?.meta?.hotel_name || '').trim();
    const normalizedHotelName = (hotelNameFromMeta || productNameRaw)
      .replace(/\s*[-|]\s*(single|double|triple|quad|quint|sextuple|family|suite|deluxe|superior)\b.*$/i, '')
      .replace(/\s+(single|double|triple|quad|quint|sextuple)\b.*$/i, '')
      .trim();
    const productName = type === ORDER_ITEM_TYPE.HOTEL ? (normalizedHotelName || productNameRaw) : productNameRaw;
    const nights = (type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) ? Math.max(1, getNights(checkIn, checkOut)) : 1;
    const subtotal = qty * unitPrice * nights;
    const displayUnitPrice = unitPrice * nights;
    const typeText = type === ORDER_ITEM_TYPE.HOTEL ? 'HTL' : typeLabel;
    const itemLabel = location
      ? `${typeText} - ${location} - ${productName}`
      : `${typeText} - ${productName}`;
    const stayLabel = (checkIn || checkOut)
      ? `CI ${formatDateOnlyForExport(checkIn)} | CO ${formatDateOnlyForExport(checkOut)}`
      : '-';
    const key = type === ORDER_ITEM_TYPE.HOTEL
      ? `${type}|${productName}|${location}|${String(checkIn || '')}|${String(checkOut || '')}|${currency}|${unitPrice}`
      : `${type}|${productName}|${currency}|${unitPrice}|${stayLabel}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.qty += qty;
      prev.subtotal += subtotal;
      if (type === ORDER_ITEM_TYPE.HOTEL && roomTypeRaw) prev.roomTypes.add(roomTypeRaw);
    } else {
      grouped.set(key, {
        itemLabel,
        qty,
        unit,
        stayLabel,
        nights,
        unitPrice,
        displayUnitPrice,
        currency,
        subtotal,
        roomTypes: type === ORDER_ITEM_TYPE.HOTEL ? new Set(roomTypeRaw ? [roomTypeRaw] : []) : null
      });
    }
  }
  return Array.from(grouped.values()).map((entry) => {
    if (entry.roomTypes instanceof Set) {
      const types = Array.from(entry.roomTypes).filter(Boolean);
      entry.roomTypeLabel = types.length ? `Tipe: ${types.join(', ')}` : '';
      delete entry.roomTypes;
    }
    return entry;
  });
}

function summarizeOrderItemsStatusForExport(inv) {
  const items = inv?.Order?.OrderItems || [];
  if (!items.length) return '-';
  return items
    .map((it) => `${String(it.type || '-').toUpperCase()}:${getOrderItemStatusForExport(it)}`)
    .join(' | ');
}

function computeInvoiceExportTotals(data) {
  const totals = {
    total_idr: 0,
    total_sar: 0,
    total_usd: 0,
    paid_idr: 0,
    paid_sar: 0,
    paid_usd: 0,
    remaining_idr: 0,
    remaining_sar: 0,
    remaining_usd: 0,
    allocation_idr: 0,
    refund_idr: 0
  };
  for (const inv of data || []) {
    const t = invoiceListAmountTriple(inv);
    const p = paidTripleForList(inv);
    const r = remainingTripleForList(inv);
    totals.total_idr += t.idr || 0;
    totals.total_sar += t.sar || 0;
    totals.total_usd += t.usd || 0;
    totals.paid_idr += p.idr || 0;
    totals.paid_sar += p.sar || 0;
    totals.paid_usd += p.usd || 0;
    totals.remaining_idr += r.idr || 0;
    totals.remaining_sar += r.sar || 0;
    totals.remaining_usd += r.usd || 0;
    totals.allocation_idr += (inv.BalanceAllocations || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    totals.refund_idr += (inv.Refunds || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  }
  return totals;
}

function buildInvoiceListExportFilterSummary(req, data = []) {
  const q = req.query || {};
  const parts = [];
  const rows = Array.isArray(data) ? data : [];
  const uniq = (arr) => Array.from(new Set(arr.filter((v) => String(v || '').trim() !== '')));
  const wilayahNames = uniq(rows.map((d) => d?.Branch?.Wilayah?.name || d?.Branch?.wilayah_name));
  const provinsiNames = uniq(rows.map((d) => d?.Branch?.Provinsi?.name || d?.Branch?.provinsi_name));
  const kotaNames = uniq(rows.map((d) => d?.Branch?.city));
  const ownerNames = uniq(rows.map((d) => (d?.User?.name || d?.owner_name_manual || '').trim()));

  if (q.status) parts.push(`Status: ${q.status}`);
  if (q.branch_id) parts.push(`Branch ID: ${q.branch_id}`);
  if (q.wilayah_id) parts.push(`Wilayah: ${wilayahNames.join(', ') || q.wilayah_id}`);
  if (q.provinsi_id) parts.push(`Provinsi: ${provinsiNames.join(', ') || q.provinsi_id}`);
  if (q.city || q.kota) parts.push(`Kota: ${String(q.city || q.kota)}`);
  if (q.owner_id) parts.push(`Owner: ${ownerNames.join(', ') || q.owner_id}`);
  if (q.invoice_number) parts.push(`No. Invoice: ${q.invoice_number}`);
  if (q.date_from || q.date_to) parts.push(`Periode: ${q.date_from || '…'} s/d ${q.date_to || '…'}`);
  if (q.due_status) parts.push(`Jatuh tempo DP: ${q.due_status}`);
  if (!parts.length) {
    const wilayahInfo = wilayahNames.length ? `Wilayah: ${wilayahNames.join(', ')}` : 'Wilayah: sesuai hak akses';
    return `Semua filter default (sesuai hak akses) · ${wilayahInfo}`;
  }
  return parts.join(' · ');
}

const exportListExcel = asyncHandler(async (req, res) => {
  const ctx = await buildInvoiceListFilters(req);
  const rows = await Invoice.findAll({
    where: ctx.where,
    include: [
      ctx.orderInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }
    ],
    order: ctx.orderBy
  });
  const data = serializeInvoiceRows(rows);
  await loadInvoiceListRelations(data);
  const totals = computeInvoiceExportTotals(data);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Daftar Invoice');
  ws.columns = [
    { width: 5 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 28 }, { width: 14 },
    { width: 18 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 28 }, { width: 24 }, { width: 28 }, { width: 44 }, { width: 44 }
  ];

  ws.mergeCells('A1:AE1');
  ws.getCell('A1').value = 'PT. BINTANG GLOBAL GRUP';
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0B4F82' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('A2:AE2');
  ws.getCell('A2').value = 'Laporan Resmi Daftar Invoice / Order';
  ws.getCell('A2').font = { bold: true, size: 12 };
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.mergeCells('A3:AE3');
  ws.getCell('A3').value = `Dicetak: ${new Date().toLocaleString('id-ID')}`;
  ws.getCell('A3').alignment = { horizontal: 'center' };
  ws.getCell('A3').font = { color: { argb: 'FF475569' } };
  ws.mergeCells('A4:AE4');
  ws.getCell('A4').value = buildInvoiceListExportFilterSummary(req, data);
  ws.getCell('A4').alignment = { horizontal: 'center', wrapText: true };
  ws.getCell('A4').font = { italic: true, color: { argb: 'FF64748B' } };

  const headers = [
    'No', 'No. Invoice', 'Tgl terbit', 'Owner', 'Tipe Owner', 'Perusahaan', 'PIC',
    'Cabang', 'Wilayah', 'Provinsi', 'Kota', 'Status Invoice', 'Status Order', 'No. Order',
    'Total IDR', 'Total SAR', 'Total USD', 'Kurs SAR→IDR', 'Kurs USD→IDR',
    'Dibayar IDR', 'Dibayar SAR', 'Dibayar USD', 'Sisa IDR', 'Sisa SAR', 'Sisa USD',
    'Alokasi saldo', 'Refund', 'Realokasi pembayaran', 'Catatan', 'Rincian Item (Nama x Qty)', 'Status Progress Item'
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1A63' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });

  if (!data.length) {
    const row = ws.addRow(['', 'Tidak ada data', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    ws.mergeCells(`B${row.number}:AE${row.number}`);
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  } else {
    data.forEach((inv, idx) => {
      const tot = invoiceListAmountTriple(inv);
      const paid = paidTripleForList(inv);
      const rem = remainingTripleForList(inv);
      const ownerName = (inv.User && inv.User.name) || inv.owner_name_manual || '-';
      const company = (inv.User && inv.User.company_name) || '-';
      const branch = inv.Branch || {};
      const wilayah = branch.Wilayah?.name || branch.wilayah_name || '-';
      const prov = branch.Provinsi?.name || branch.provinsi_name || '-';
      const kota = branch.city || '-';
      const cabang = branch.name || branch.code || '-';
      const orderNo = (inv.Order && inv.Order.order_number) ? String(inv.Order.order_number) : '-';
      const orderSt = (inv.Order && inv.Order.status) ? String(inv.Order.status) : '-';
      const notes = [inv.notes, inv.cancellation_handling_note].filter(Boolean).join(' | ') || '-';
      const itemSummary = summarizeOrderItemsForExport(inv);
      const itemStatusSummary = summarizeOrderItemsStatusForExport(inv);
      const row = ws.addRow([
        idx + 1,
        inv.invoice_number || '-',
        inv.issued_at ? new Date(inv.issued_at).toLocaleString('id-ID') : '-',
        ownerName,
        inv.owner_is_mou ? 'MOU' : 'Non-MOU',
        company,
        inv.pic_name || '-',
        cabang,
        wilayah,
        prov,
        kota,
        getInvoiceStatusLabelForExport(inv),
        orderSt,
        orderNo,
        tot.idr,
        tot.sar,
        tot.usd,
        tot.sarToIdr,
        tot.usdToIdr,
        paid.idr,
        paid.sar,
        paid.usd,
        rem.idr,
        rem.sar,
        rem.usd,
        summarizeBalanceAllocForExport(inv),
        summarizeRefundsForExport(inv),
        summarizeReallocForExport(inv),
        notes,
        itemSummary,
        itemStatusSummary
      ]);
      row.getCell(15).numFmt = '"Rp" #,##0';
      row.getCell(16).numFmt = '#,##0.00';
      row.getCell(17).numFmt = '#,##0.00';
      row.getCell(18).numFmt = '#,##0.00';
      row.getCell(19).numFmt = '#,##0.00';
      row.getCell(20).numFmt = '"Rp" #,##0';
      row.getCell(21).numFmt = '#,##0.00';
      row.getCell(22).numFmt = '#,##0.00';
      row.getCell(23).numFmt = '"Rp" #,##0';
      row.getCell(24).numFmt = '#,##0.00';
      row.getCell(25).numFmt = '#,##0.00';
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Ringkasan total seluruh data (semua baris hasil filter)
    const spacer = ws.addRow(new Array(31).fill(''));
    spacer.height = 6;
    const totalRow = ws.addRow([
      '', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL SELURUH DATA',
      totals.total_idr,
      totals.total_sar,
      totals.total_usd,
      '',
      '',
      totals.paid_idr,
      totals.paid_sar,
      totals.paid_usd,
      totals.remaining_idr,
      totals.remaining_sar,
      totals.remaining_usd,
      totals.allocation_idr,
      totals.refund_idr,
      '-',
      '-',
      '-',
      '-'
    ]);
    ws.mergeCells(`A${totalRow.number}:N${totalRow.number}`);
    totalRow.getCell(1).value = 'TOTAL SELURUH DATA';
    totalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1A63' } };
    totalRow.getCell(15).numFmt = '"Rp" #,##0';
    totalRow.getCell(16).numFmt = '#,##0.00';
    totalRow.getCell(17).numFmt = '#,##0.00';
    totalRow.getCell(20).numFmt = '"Rp" #,##0';
    totalRow.getCell(21).numFmt = '#,##0.00';
    totalRow.getCell(22).numFmt = '#,##0.00';
    totalRow.getCell(23).numFmt = '"Rp" #,##0';
    totalRow.getCell(24).numFmt = '#,##0.00';
    totalRow.getCell(25).numFmt = '#,##0.00';
    totalRow.getCell(26).numFmt = '"Rp" #,##0';
    totalRow.getCell(27).numFmt = '"Rp" #,##0';
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { ...(cell.font || {}), bold: true, color: { argb: colNumber <= 14 ? 'FFFFFFFF' : 'FF0D1A63' } };
      if (colNumber >= 15) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });
  }

  const filename = `daftar-invoice-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

const exportListPdf = asyncHandler(async (req, res) => {
  const ctx = await buildInvoiceListFilters(req);
  const rows = await Invoice.findAll({
    where: ctx.where,
    include: [
      ctx.orderInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] }
    ],
    order: ctx.orderBy
  });
  const data = serializeInvoiceRows(rows);
  await loadInvoiceListRelations(data);
  const totals = computeInvoiceExportTotals(data);

  const filename = `daftar-invoice-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  doc.pipe(res);

  let y = drawCorporateLetterhead(doc, { margin: 36 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('LAPORAN RESMI DAFTAR INVOICE', 36, y, { align: 'center', width: doc.page.width - 72 });
  y += 20;
  const filterSummaryRaw = buildInvoiceListExportFilterSummary(req, data);
  const filterSummaryClean = String(filterSummaryRaw || '')
    .replace(/^Semua filter default \(sesuai hak akses\)\s*·\s*/i, '')
    .trim();
  if (filterSummaryClean) {
    doc.font('Helvetica').fontSize(9).fillColor('#334155')
      .text(filterSummaryClean, 36, y, { width: doc.page.width - 72, align: 'center' });
    y += 28;
  } else {
    y += 8;
  }
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Jumlah baris: ${data.length} · Tanggal cetak: ${formatDateTimeJakartaForExport(new Date())}`, 36, y, { align: 'center', width: doc.page.width - 72 });
  y += 22;

  const ownerFilterActive = !!(req.query?.owner_id || req.query?.owner || req.query?.owner_name);
  const col = {
    no: 36,
    inv: 52,
    owner: ownerFilterActive ? null : 112,
    status: ownerFilterActive ? 116 : 230,
    item: ownerFilterActive ? 190 : 290,
    payment: ownerFilterActive ? 470 : 515,
    total: 620,
    paid: 685,
    remain: 750
  };
  const drawTableHeader = () => {
    doc.rect(36, y, doc.page.width - 72, 20).fill('#0D1A63');
    const h = doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
    h.text('No', col.no + 2, y + 6)
      .text('Invoice', col.inv + 2, y + 6);
    if (!ownerFilterActive && col.owner != null) h.text('Owner', col.owner + 2, y + 6);
    h.text('Status', col.status + 2, y + 6)
      .text('Item & Qty', col.item + 2, y + 6)
      .text('Riwayat Pembayaran', col.payment + 2, y + 6)
      .text('Total', col.total + 2, y + 6)
      .text('Dibayar', col.paid + 2, y + 6)
      .text('Sisa', col.remain + 2, y + 6);
    y += 22;
  };
  drawTableHeader();

  if (!data.length) {
    doc.font('Helvetica-Oblique').fillColor('#64748b').fontSize(9).text('Tidak ada data.', 36, y + 4);
  } else {
    data.forEach((inv, idx) => {
      const tot = invoiceListAmountTriple(inv);
      const paid = paidTripleForList(inv);
      const rem = remainingTripleForList(inv);
      const ownerName = (inv.User && inv.User.name) || inv.owner_name_manual || '-';
      const company = (inv.User && inv.User.company_name) || '';
      const ownerLines = [ownerName, company || '-'];
      const branch = inv.Branch || {};
      const cabang = (branch.name || branch.code || '-');
      const invoiceDate = inv.issued_at || inv.created_at || inv.createdAt || inv.date;
      const items = buildPdfOrderItemsDetailed(inv);
      const paymentHistory = buildPaymentHistoryLines(inv);
      // Tampilkan item invoice lebih lengkap (visa/bus/tiket/handling tidak terpotong terlalu cepat).
      const itemRows = Math.max(1, Math.min(items.length, 6));
      const historyRows = Math.max(1, Math.min(paymentHistory.length, 4));
      const lines = Math.max(itemRows, historyRows);
      const rowCellH = 28;
      const contentBlockH = 30 + lines * rowCellH;
      const blockH = contentBlockH + 10;
      if (y + blockH > doc.page.height - 48) {
        doc.addPage();
        y = drawCorporateLetterhead(doc, { margin: 36 });
        y += 8;
        drawTableHeader();
      }
      doc.rect(36, y, doc.page.width - 72, blockH).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(36, y, doc.page.width - 72, blockH).stroke();
      const r = doc.font('Helvetica').fontSize(7).fillColor('#0f172a');
      r.text(String(idx + 1), col.no + 2, y + 4, { width: 14 })
        .text(String(inv.invoice_number || '-').slice(0, 16), col.inv + 2, y + 4, { width: 60 });
      if (!ownerFilterActive && col.owner != null) {
        r.text(`${ownerLines.join('\n')}\nCab: ${cabang}\nTgl Inv: ${formatDateOnlyForExport(invoiceDate)}`.slice(0, 220), col.owner + 2, y + 4, { width: (col.status - col.owner - 6), height: blockH - 8 });
      }
      r.text(String(getInvoiceStatusLabelForExport(inv)).slice(0, 26), col.status + 2, y + 4, { width: (col.item - col.status - 6) });

      // Mini-table item: tampil ringkas agar tidak overlap dengan kolom lain.
      const itemX = col.item + 2;
      const itemW = col.payment - col.item - 6;
      const headerH = 12;
      const rowTop = y + 4;
      doc.rect(itemX, rowTop, itemW, headerH).fill('#E0E7FF');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(itemX, rowTop, itemW, headerH).stroke();
      const subPriceW = Math.max(86, Math.floor(itemW * 0.42));
      const subItemW = Math.max(90, itemW - subPriceW);
      const xPrice = itemX + subItemW;
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.6)
        .text('Item & Detail', itemX + 2, rowTop + 3, { width: subItemW - 4 })
        .text('Harga / Subtotal', xPrice + 2, rowTop + 3, { width: subPriceW - 4, align: 'left' });
      doc.strokeColor('#cbd5e1').lineWidth(0.5)
        .moveTo(xPrice, rowTop).lineTo(xPrice, rowTop + headerH).stroke();

      doc.font('Helvetica').fontSize(6.8).fillColor('#0f172a');
      const showItems = items.length ? items.slice(0, itemRows) : [{ itemLabel: '-', qty: 0, unit: 'qty', stayLabel: '-', unitPrice: 0, currency: 'IDR', subtotal: 0 }];
      showItems.forEach((it, i) => {
        const rowH = rowCellH;
        const ry = rowTop + headerH + i * rowH;
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(itemX, ry, itemW, rowH).stroke();
        doc.strokeColor('#e2e8f0').lineWidth(0.5)
          .moveTo(xPrice, ry).lineTo(xPrice, ry + rowH).stroke();
        const unitTriple = amountTripleForDisplay(it.displayUnitPrice || it.unitPrice, it.currency, tot.sarToIdr, tot.usdToIdr);
        const subtotalTriple = amountTripleForDisplay(it.subtotal, it.currency, tot.sarToIdr, tot.usdToIdr);
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.2).text(String(it.itemLabel || '-').slice(0, 72), itemX + 2, ry + 2, {
          width: subItemW - 4, height: 10, lineBreak: false
        });
        const nightLabel = Number(it.nights || 1) > 1 ? `${it.nights} malam` : '';
        const detailText = [ `${it.qty} ${it.unit}`, String(it.stayLabel || '-'), nightLabel, String(it.roomTypeLabel || '') ]
          .filter((v) => String(v || '').trim() !== '')
          .join(' | ');
        doc.fillColor('#0f172a').font('Helvetica').fontSize(6).text(detailText.slice(0, 68), itemX + 2, ry + 12, {
          width: subItemW - 4, height: 10, lineBreak: false
        });
        doc.fillColor('#0f172a').fontSize(5.8).text(
          `H: Rp ${Math.round(unitTriple.idr).toLocaleString('id-ID')} | S ${unitTriple.sar.toFixed(1)} | U ${unitTriple.usd.toFixed(1)}`.slice(0, 52),
          xPrice + 2,
          ry + 2,
          { width: subPriceW - 4, height: 10, lineBreak: false }
        );
        doc.fillColor('#0f172a').fontSize(5.8).text(
          `S: Rp ${Math.round(subtotalTriple.idr).toLocaleString('id-ID')} | S ${subtotalTriple.sar.toFixed(1)} | U ${subtotalTriple.usd.toFixed(1)}`.slice(0, 52),
          xPrice + 2,
          ry + 12,
          { width: subPriceW - 4, height: 10, lineBreak: false }
        );
      });
      const historyX = col.payment + 2;
      const historyW = col.total - col.payment - 8;
      doc.rect(historyX, rowTop, historyW, headerH).fill('#E0E7FF');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(historyX, rowTop, historyW, headerH).stroke();
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.4)
        .text('Informasi Transaksi', historyX + 2, rowTop + 3, { width: historyW - 4, lineBreak: false });
      const showHistory = paymentHistory.slice(0, historyRows);
      showHistory.forEach((entry, i) => {
        const rowH = rowCellH;
        const ry = rowTop + headerH + i * rowH;
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(historyX, ry, historyW, rowH).stroke();
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(5.8).text(String(entry?.info1 || '-').slice(0, 72), historyX + 2, ry + 2, {
          width: historyW - 4, height: 9, lineBreak: false
        });
        doc.fillColor('#0f172a').font('Helvetica').fontSize(5.6).text(String(entry?.info2 || '').slice(0, 90), historyX + 2, ry + 11, {
          width: historyW - 4, height: 8, lineBreak: false
        });
        doc.fillColor('#0f172a').font('Helvetica').fontSize(5.6).text(String(entry?.info3 || '').slice(0, 90), historyX + 2, ry + 19, {
          width: historyW - 4, height: 8, lineBreak: false
        });
      });
      // Mini-table: Total / Dibayar / Sisa agar data nominal lebih terstruktur.
      const amtX = col.total + 2;
      const amtY = y + 4;
      const amtW = (doc.page.width - 36) - amtX - 2;
      const amtH = contentBlockH - 8;
      const amtHeaderH = 12;
      doc.rect(amtX, amtY, amtW, amtHeaderH).fill('#E0E7FF');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(amtX, amtY, amtW, amtH).stroke();
      // Pakai lebar seimbang agar angka di kolom "Sisa" tidak terpotong (sebelumnya terlalu sempit).
      const aw1 = Math.floor(amtW / 3);
      const aw2 = Math.floor(amtW / 3);
      const aw3 = amtW - aw1 - aw2;
      const ax2 = amtX + aw1;
      const ax3 = amtX + aw1 + aw2;
      doc.strokeColor('#cbd5e1').lineWidth(0.5)
        .moveTo(ax2, amtY).lineTo(ax2, amtY + amtH).stroke()
        .moveTo(ax3, amtY).lineTo(ax3, amtY + amtH).stroke();

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.6)
        .text('Total', amtX + 2, amtY + 3, { width: aw1 - 4 })
        .text('Dibayar', ax2 + 2, amtY + 3, { width: aw2 - 4 })
        .text('Sisa', ax3 + 2, amtY + 3, { width: aw3 - 4 });

      const amountRows = [
        [`Rp ${tot.idr.toLocaleString('id-ID')}`, `Rp ${paid.idr.toLocaleString('id-ID')}`, `Rp ${rem.idr.toLocaleString('id-ID')}`],
        [`SAR ${tot.sar.toFixed(2)}`, `SAR ${paid.sar.toFixed(2)}`, `SAR ${rem.sar.toFixed(2)}`],
        [`USD ${tot.usd.toFixed(2)}`, `USD ${paid.usd.toFixed(2)}`, `USD ${rem.usd.toFixed(2)}`]
      ];
      const rowH = Math.max(10, (amtH - amtHeaderH) / amountRows.length);
      amountRows.forEach((vals, i) => {
        const ry = amtY + amtHeaderH + i * rowH;
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(amtX, ry).lineTo(amtX + amtW, ry).stroke();
        doc.fillColor('#0f172a').font('Helvetica').fontSize(6.8)
          .text(vals[0], amtX + 2, ry + 2, { width: aw1 - 4, height: rowH - 2, align: 'left', lineBreak: false })
          .text(vals[1], ax2 + 2, ry + 2, { width: aw2 - 4, height: rowH - 2, align: 'left', lineBreak: false })
          .text(vals[2], ax3 + 2, ry + 2, { width: aw3 - 4, height: rowH - 2, align: 'left', lineBreak: false });
      });
      doc.font('Helvetica-Oblique').fontSize(6.6).fillColor('#0b4f82')
        .text(`Kurs dipakai: SAR ${Number(tot.sarToIdr || 0).toLocaleString('id-ID')} | USD ${Number(tot.usdToIdr || 0).toLocaleString('id-ID')}`, amtX + 2, y + contentBlockH + 1, { width: amtW - 4, align: 'right' });
      y += blockH;
    });
  }

  if (y + 92 > doc.page.height - 36) {
    doc.addPage();
    y = drawCorporateLetterhead(doc, { margin: 36 });
    y += 8;
  }
  // TOTAL SELURUH DATA sebagai tabel agar mudah dibaca.
  const boxH = 86;
  doc.rect(36, y, doc.page.width - 72, boxH).fill('#E0E7FF');
  doc.strokeColor('#94A3B8').lineWidth(0.7).rect(36, y, doc.page.width - 72, boxH).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0D1A63').text('TOTAL SELURUH DATA', 42, y + 10);

  const tx = 190;
  const tw = doc.page.width - 72 - (tx - 36);
  const th = 60;
  const ty = y + 16;
  doc.rect(tx, ty, tw, th).fill('#ffffff');
  doc.strokeColor('#94A3B8').lineWidth(0.7).rect(tx, ty, tw, th).stroke();

  const c0 = tx;
  const c1 = tx + 120;
  const c2 = c1 + 170;
  const c3 = c2 + 120;
  const c4 = tx + tw;
  // header row
  doc.rect(tx, ty, tw, 16).fill('#0D1A63');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
    .text('Keterangan', c0 + 6, ty + 4, { width: 110 })
    .text('IDR', c1 + 6, ty + 4, { width: 160 })
    .text('SAR', c2 + 6, ty + 4, { width: 110 })
    .text('USD', c3 + 6, ty + 4, { width: c4 - c3 - 8 });
  doc.strokeColor('#94A3B8').lineWidth(0.7)
    .moveTo(c1, ty).lineTo(c1, ty + th).stroke()
    .moveTo(c2, ty).lineTo(c2, ty + th).stroke()
    .moveTo(c3, ty).lineTo(c3, ty + th).stroke();

  const rowsTotals = [
    { label: 'Total Tagihan', idr: totals.total_idr, sar: totals.total_sar, usd: totals.total_usd },
    { label: 'Total Dibayar', idr: totals.paid_idr, sar: totals.paid_sar, usd: totals.paid_usd },
    { label: 'Total Sisa', idr: totals.remaining_idr, sar: totals.remaining_sar, usd: totals.remaining_usd }
  ];
  doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
  rowsTotals.forEach((r, i) => {
    const ry = ty + 16 + i * 14;
    doc.strokeColor('#e2e8f0').lineWidth(0.6).moveTo(tx, ry).lineTo(tx + tw, ry).stroke();
    doc.fillColor('#0f172a').text(r.label, c0 + 6, ry + 3, { width: 110 });
    doc.font('Helvetica').text(`Rp ${Number(r.idr || 0).toLocaleString('id-ID')}`, c1 + 6, ry + 3, { width: 160 });
    doc.font('Helvetica').text(`${Number(r.sar || 0).toFixed(2)} SAR`, c2 + 6, ry + 3, { width: 110 });
    doc.font('Helvetica').text(`${Number(r.usd || 0).toFixed(2)} USD`, c3 + 6, ry + 3, { width: c4 - c3 - 8 });
    doc.font('Helvetica');
  });

  doc.end();
});

const list = asyncHandler(async (req, res) => {
  const { limit = 25, page = 1, order_status } = req.query;
  const ctx = await buildInvoiceListFilters(req);
  const { where, orderInclude, orderBy } = ctx;

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

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

  const data = serializeInvoiceRows(rows);
  await loadInvoiceListRelations(data);

  /** Perbaiki paid_amount di DB + payload list jika sempat tertimpa sync "hanya bukti" padahal ada alokasi saldo. */
  const idsForHeal = data.map((d) => d.id).filter(Boolean);
  if (idsForHeal.length > 0) {
    const allocRows = await OwnerBalanceTransaction.findAll({
      attributes: ['reference_id', [sequelize.fn('SUM', sequelize.col('amount')), 'sum_amt']],
      where: { reference_type: 'invoice', type: 'allocation', reference_id: { [Op.in]: idsForHeal } },
      group: ['reference_id'],
      raw: true
    });
    const allocByInv = {};
    for (const r of allocRows) {
      const n = parseFloat(r.sum_amt);
      allocByInv[r.reference_id] = Number.isFinite(n) && n < 0 ? Math.abs(n) : 0;
    }
    for (const d of data) {
      const proofList = d.PaymentProofs || [];
      const vSum = proofList
        .filter((p) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at != null && p.verified_status !== 'rejected'))
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const combined = vSum + (allocByInv[d.id] || 0);
      const cur = parseFloat(d.paid_amount) || 0;
      if (Math.abs(combined - cur) <= 0.01) continue;
      const inv = await Invoice.findByPk(d.id);
      if (!inv) continue;
      const totalInv = parseFloat(inv.total_amount) || 0;
      const remaining = Math.max(0, totalInv - combined);
      let newStatus = inv.status;
      if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
      else if ((parseFloat(inv.dp_amount) || 0) > 0 && combined >= parseFloat(inv.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      else if (combined > 0 && [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED].includes(inv.status)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      await updateInvoiceWithAudit(inv, { paid_amount: combined, remaining_amount: remaining, status: newStatus }, { changedBy: null, reason: 'sync_paid_on_list', meta: { verified_sum: vSum, balance_allocation_sum: allocByInv[d.id] || 0 } });
      const invReload = await Invoice.findByPk(d.id, { attributes: ['id', 'order_id', 'total_amount', 'paid_amount', 'dp_amount', 'status'] });
      if (invReload) await updateOrderDpStatusFromInvoice(invReload);
      d.paid_amount = combined;
      d.remaining_amount = remaining;
      d.status = newStatus;
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
  if (req.user.role === 'role_siskopatuh') {
    const siskRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.SISKOPATUH }, attributes: ['order_id'], raw: true });
    const siskOrderIds = [...new Set((siskRows || []).map((r) => r.order_id))].filter((id) => !withInvIds.includes(id));
    orderWhereDraft.id = siskOrderIds.length ? { [Op.in]: siskOrderIds } : { [Op.in]: [] };
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
      where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.SISKOPATUH, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE] } },
      required: false,
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta'],
      include: [
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type', 'meta'], required: false },
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
      pic_name: plain.pic_name || null,
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
  if (req.user.branch_id && !isOwnerRole(req.user.role) && req.user.role !== 'role_hotel' && req.user.role !== 'role_bus' && req.user.role !== 'handling' && req.user.role !== 'role_siskopatuh' && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }
  if (req.user.wilayah_id && isKoordinatorRole(req.user.role)) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (branchIds.length) where.branch_id = { [Op.in]: branchIds };
    // bila wilayah tidak punya cabang ter-link: jangan set filter agar summary tampil
  }
  // Sama seperti list: divisi melihat summary untuk semua order bertipe terkait (termasuk belum bayar DP).
  const divisiProgressRolesSummary = ['role_hotel', 'role_bus', 'handling', 'role_siskopatuh', 'visa_koordinator', 'tiket_koordinator'];
  if (divisiProgressRolesSummary.includes(req.user.role)) {
    let orderIdsByType = [];
    if (req.user.role === 'role_hotel') {
      const hotelRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HOTEL }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((hotelRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_bus') {
      const [busRows, visaRows] = await Promise.all([
        OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true }),
        OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true })
      ]);
      const orderIdsFromBus = [...new Set((busRows || []).map((r) => r.order_id))];
      const orderIdsFromVisaRaw = [...new Set((visaRows || []).map((r) => r.order_id))];
      const visaOnlyOrders = orderIdsFromVisaRaw.length
        ? await Order.findAll({
          where: { id: { [Op.in]: orderIdsFromVisaRaw }, bus_service_option: 'visa_only' },
          attributes: ['id'],
          raw: true
        })
        : [];
      const visaOnlySet = new Set((visaOnlyOrders || []).map((o) => o.id));
      const orderIdsFromVisa = orderIdsFromVisaRaw.filter((oid) => !visaOnlySet.has(oid));
      const waiveOrders = await Order.findAll({ where: { waive_bus_penalty: true }, attributes: ['id'], raw: true });
      const orderIdsWaive = (waiveOrders || []).map((o) => o.id);
      orderIdsByType = [...new Set([...orderIdsFromBus, ...orderIdsFromVisa, ...orderIdsWaive])];
    } else if (req.user.role === 'handling') {
      const handlingRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.HANDLING }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((handlingRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'role_siskopatuh') {
      const siskRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.SISKOPATUH }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((siskRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'visa_koordinator') {
      const visaRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((visaRows || []).map((r) => r.order_id))];
    } else if (req.user.role === 'tiket_koordinator') {
      const ticketRows = await OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.TICKET }, attributes: ['order_id'], raw: true });
      orderIdsByType = [...new Set((ticketRows || []).map((r) => r.order_id))];
    }
    where.order_id = orderIdsByType.length ? { [Op.in]: orderIdsByType } : { [Op.in]: [] };
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
 * Create invoice from order. Status tentative; jatuh tempo DP & auto_cancel = order.created_at + dp_grace_hours.
 */
const create = asyncHandler(async (req, res) => {
  const { order_id, is_super_promo, dp_percentage: bodyDpPct, dp_amount: bodyDpAmount, pic_name: bodyPicName } = req.body;
  const order = await Order.findByPk(order_id, { include: ['OrderItems'] });
  if (!order) return res.status(404).json({ success: false, message: 'Trip tidak ditemukan' });
  if (order.owner_id !== req.user.id && !['invoice_koordinator', 'invoice_saudi', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }

  const existing = await Invoice.findOne({ where: { order_id } });
  if (existing) return res.status(400).json({ success: false, message: 'Trip ini sudah memiliki invoice' });

  const picFromBody = typeof bodyPicName === 'string' ? bodyPicName.trim() : '';
  const picFromOrder = order.pic_name != null ? String(order.pic_name).trim() : '';
  const picName = picFromBody || picFromOrder;
  if (!picName) {
    return res.status(400).json({ success: false, message: 'Nama PIC wajib diisi' });
  }
  if (picName !== picFromOrder) {
    await order.update({ pic_name: picName });
  }

  const rules = await getRulesForBranch(order.branch_id);
  const dpGraceHours = rules.dp_grace_hours ?? 24;
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
  const dueDateDp = computeDpDeadlineFromOrder(order, dpGraceHours);
  const autoCancelAt = new Date(dueDateDp.getTime());

  const rates = await getOrderRatesForConversion(order.id);
  const sarToIdr = rates.SAR_TO_IDR && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const invoice = await Invoice.create({
    invoice_number: generateInvoiceNumber(),
    order_id: order.id,
    owner_id: order.owner_id,
    owner_name_manual: order.owner_name_manual || null,
    owner_phone_manual: order.owner_phone_manual || null,
    owner_input_mode: order.owner_input_mode || (order.owner_id ? 'registered' : 'manual'),
    branch_id: order.branch_id,
    pic_name: picName,
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
      `Invoice batal otomatis bila dalam ${dpGraceHours} jam setelah order dibuat belum ada DP`,
      `Minimal DP ${dpPercentage}% dari total`,
      `Jatuh tempo DP ${dpGraceHours} jam setelah order dibuat`
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

  if (order.owner_id) {
    const notif = await Notification.create({
      user_id: order.owner_id,
      trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
      title: 'Invoice baru',
      message: `Invoice ${invoice.invoice_number}. Bayar DP paling lambat ${dpGraceHours} jam sejak order dibuat.`,
      data: { order_id: order.id, invoice_id: invoice.id },
      channel_in_app: true,
      channel_email: true
    });
    const dueInfo = `Bayar DP paling lambat ${dpGraceHours} jam sejak order dibuat.`;
    setImmediate(() => sendInvoiceCreatedNotificationEmail(invoice.id, notif.id, dueInfo));
  }

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
  let picName = (opts.pic_name != null && String(opts.pic_name).trim()) || '';
  if (!picName && order.pic_name != null) picName = String(order.pic_name).trim();
  if (!picName) {
    const ordRow = await Order.findByPk(orderId, { attributes: ['pic_name'] });
    if (ordRow?.pic_name) picName = String(ordRow.pic_name).trim();
  }
  if (!picName) {
    const err = new Error('Nama PIC wajib diisi di form invoice sebelum invoice dapat diterbitkan.');
    err.statusCode = 400;
    throw err;
  }
  let rules = {};
  try {
    rules = await getRulesForBranch(order.branch_id) || {};
  } catch (e) {
    console.warn('createInvoiceForOrder getRulesForBranch failed, using defaults:', e?.message);
  }
  const dpGraceHours = rules.dp_grace_hours ?? 24;
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
  const dueDateDp = computeDpDeadlineFromOrder(order, dpGraceHours);
  const autoCancelAt = new Date(dueDateDp.getTime());
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
    owner_name_manual: order.owner_name_manual || null,
    owner_phone_manual: order.owner_phone_manual || null,
    owner_input_mode: order.owner_input_mode || (order.owner_id ? 'registered' : 'manual'),
    branch_id: order.branch_id,
    pic_name: picName,
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
      `Invoice batal otomatis bila dalam ${dpGraceHours} jam setelah order dibuat belum ada DP`,
      `Minimal DP ${dpPercentage}% dari total`,
      `Jatuh tempo DP ${dpGraceHours} jam setelah order dibuat`
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
  if (order.owner_id) {
    const notif = await Notification.create({
      user_id: order.owner_id,
      trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
      title: 'Invoice baru',
      message: `Invoice ${invoice.invoice_number}. Bayar DP paling lambat ${dpGraceHours} jam sejak order dibuat.`,
      data: { order_id: orderId, invoice_id: invoice.id },
      channel_in_app: true,
      channel_email: true
    });
    const dueInfo = `Bayar DP paling lambat ${dpGraceHours} jam sejak order dibuat.`;
    setImmediate(() => sendInvoiceCreatedNotificationEmail(invoice.id, notif.id, dueInfo));
  }
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
      { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type', 'meta'], required: false }, { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at', 'notes'] }, { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at', 'notes'] }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time', 'notes'] }, { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'bus_ticket_info', 'arrival_status', 'departure_status', 'return_status', 'notes'] }] }] },
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
    const orderItems = order?.OrderItems || [];
    const hasBus = orderItems.some((it) => it.type === 'bus');
    const hasVisa = orderItems.some((it) => it.type === 'visa');
    const visaOnlyNoBus = String(order?.bus_service_option || '') === 'visa_only' && !hasBus;
    if (visaOnlyNoBus) return res.status(403).json({ success: false, message: 'Order ini hanya visa tanpa layanan bus.' });
    if (!hasBus && !hasVisa) return res.status(403).json({ success: false, message: 'Invoice ini tidak berisi item bus atau visa (bus include)' });
  }
  if (req.user.role === 'role_siskopatuh') {
    const order = invoice.Order || await Order.findByPk(invoice.order_id, { include: [{ model: OrderItem, as: 'OrderItems', attributes: ['type'] }] });
    const hasSisk = (order?.OrderItems || []).some((it) => it.type === 'siskopatuh');
    if (!hasSisk) return res.status(403).json({ success: false, message: 'Invoice ini tidak berisi item siskopatuh' });
  }
  await ensureBlockedStatus(invoice);
  // Sinkronkan paid_amount: bukti terverifikasi + alokasi saldo (allocate-balance tidak punya PaymentProof)
  const proofs = invoice.PaymentProofs || [];
  const verifiedSum = proofs
    .filter(p => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at != null && p.verified_status !== 'rejected'))
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const allocSum = await sumBalanceAllocationsToInvoice(invoice.id);
  const combinedPaid = verifiedSum + allocSum;
  const currentPaid = parseFloat(invoice.paid_amount) || 0;
  if (Math.abs(combinedPaid - currentPaid) > 0.01) {
    const totalInv = parseFloat(invoice.total_amount) || 0;
    const remaining = Math.max(0, totalInv - combinedPaid);
    let newStatus = invoice.status;
    if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
    else if ((parseFloat(invoice.dp_amount) || 0) > 0 && combinedPaid >= parseFloat(invoice.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    else if (combinedPaid > 0 && [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED].includes(invoice.status)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    await updateInvoiceWithAudit(invoice, { paid_amount: combinedPaid, remaining_amount: remaining, status: newStatus }, { changedBy: null, reason: 'sync_paid_on_get', meta: { verified_sum: verifiedSum, balance_allocation_sum: allocSum } });
    invoice.paid_amount = combinedPaid;
    invoice.remaining_amount = remaining;
    invoice.status = newStatus;
  } else if (invoice.status === INVOICE_STATUS.TENTATIVE && combinedPaid > 0) {
    const dpAmt = parseFloat(invoice.dp_amount) || 0;
    if (dpAmt > 0 && combinedPaid >= dpAmt) {
      await updateInvoiceWithAudit(invoice, { status: INVOICE_STATUS.PARTIAL_PAID }, { changedBy: null, reason: 'sync_paid_on_get', meta: { verified_sum: verifiedSum, balance_allocation_sum: allocSum } });
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
  await attachResolvedBankAccountsForPdf(data, invoice);
  if (data.Branch && (data.Branch.code || data.Branch.provinsi_id)) {
    try {
      const loc = await enrichBranchWithLocation(data.Branch, { syncDb: false });
      data.Branch.provinsi_name = loc.provinsi_name ?? data.Branch.provinsi_name;
      data.Branch.wilayah_name = loc.wilayah_name ?? data.Branch.wilayah_name;
      data.Branch.provinsi_id = loc.provinsi_id ?? data.Branch.provinsi_id;
      data.Branch.wilayah_id = loc.wilayah_id ?? data.Branch.wilayah_id;
    } catch (_) { /* non-fatal */ }
  }
  const balAllocRows = await OwnerBalanceTransaction.findAll({
    where: { reference_type: 'invoice', reference_id: invoice.id, type: 'allocation' },
    attributes: ['id', 'amount', 'notes', 'created_at'],
    order: [['created_at', 'ASC']],
    raw: true
  });
  data.BalanceAllocations = balAllocRows.map(mapBalanceAllocRow);
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
    auto_cancel_at: newAutoCancelAt,
    due_date_dp: newAutoCancelAt
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
 * Body: { handling: 'refund'|'transfer_order', target_order_id? }
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
  const { handling } = req.body;
  if (handling === 'transfer_invoice' || req.body?.target_invoice_id) {
    return res.status(400).json({
      success: false,
      message: 'Pemindahan kelebihan bayar ke invoice lain tidak digunakan. Gunakan refund (rekening) atau transfer_order sesuai kebijakan.'
    });
  }
  if (!['refund', 'transfer_order'].includes(handling)) {
    return res.status(400).json({ success: false, message: 'handling harus refund atau transfer_order' });
  }
  await invoice.update({ overpaid_handling: handling, overpaid_amount: 0 });
  const full = await Invoice.findByPk(invoice.id);
  res.json({ success: true, data: full });
});

/**
 * POST /api/v1/invoices/:id/allocate-balance
 * Owner (atau invoice koordinator): alokasikan saldo ke tagihan invoice.
 * Body: { amount: number }. Mengurangi saldo owner dan menambah paid_amount invoice.
 * Setelah alokasi, order.dp_payment_status disinkronkan agar tampil "Pembayaran DP" di Progress/Invoice.
 */
const allocateBalance = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  const st = String(invoice.status || '').toLowerCase();
  const blockedStatuses = [
    'canceled',
    'cancelled',
    String(INVOICE_STATUS.CANCELLED_REFUND || '').toLowerCase(),
    String(INVOICE_STATUS.REFUNDED || '').toLowerCase(),
    String(INVOICE_STATUS.REFUND_CANCELED || '').toLowerCase()
  ].filter(Boolean);
  if (blockedStatuses.includes(st)) {
    return res.status(400).json({
      success: false,
      message: 'Invoice sudah dibatalkan/refund. Pembayaran menggunakan saldo akun tidak dapat dilakukan.'
    });
  }
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

  await sequelize.transaction(async (tx) => {
    await profile.update({ balance: newBalance }, { transaction: tx });
    await updateInvoiceWithAudit(invoice, { paid_amount: newPaid, remaining_amount: newRemaining, status: newStatus }, { changedBy: req.user.id, reason: 'allocate_balance', meta: { amount: allocateAmount }, transaction: tx });
    await OwnerBalanceTransaction.create({
      owner_id: invoice.owner_id,
      amount: -allocateAmount,
      type: 'allocation',
      reference_type: 'invoice',
      reference_id: invoice.id,
      notes: `Alokasi ke invoice ${invoice.invoice_number}. Saldo -${allocateAmount.toLocaleString('id-ID')}`
    }, { transaction: tx });
  });

  // Sinkronkan status DP order agar tampil "Pembayaran DP" di menu Progress / Invoice
  const invReload = await Invoice.findByPk(invoice.id, { attributes: ['id', 'order_id', 'total_amount', 'paid_amount', 'dp_amount', 'status'] });
  if (invReload) await updateOrderDpStatusFromInvoice(invReload);

  const full = await Invoice.findByPk(invoice.id, {
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'owner_id', 'dp_payment_status', 'dp_percentage_paid'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }
    ]
  });
  const balAfterAlloc = await OwnerBalanceTransaction.findAll({
    where: { reference_type: 'invoice', reference_id: invoice.id, type: 'allocation' },
    attributes: ['id', 'amount', 'notes', 'created_at'],
    order: [['created_at', 'ASC']],
    raw: true
  });
  const fullJson = full.get({ plain: true });
  fullJson.BalanceAllocations = balAfterAlloc.map(mapBalanceAllocRow);
  res.json({ success: true, data: fullJson, message: `Saldo Rp ${allocateAmount.toLocaleString('id-ID')} berhasil dialokasikan ke invoice ${invoice.invoice_number}` });
});

/**
 * GET /api/v1/invoices/:id/pdf
 * Unduh invoice dalam format PDF. File disimpan ke disk (local) dan metadata ke DB.
 */
const getPdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id, {
    include: [
      { model: Order, as: 'Order', include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type', 'meta'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status'] }] }] },
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
  data.BalanceAllocations = await loadBalanceAllocationsForInvoicePdf(invoice.id);
  await attachResolvedBankAccountsForPdf(data, invoice);
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

  // Format: STATUS_INV_NamaOwner_deskripsiBarisPertama_tanggal.pdf
  const statusLabel = getEffectiveStatusLabel(data);
  const safe = (s) => (String(s || '').replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim() || 'invoice');
  const ownerName = (invoice.User && (invoice.User.name || invoice.User.company_name)) || invoice.owner_name_manual || invoice.Order?.owner_name_manual || 'Owner';
  const dateOrder = (invoice.issued_at || invoice.created_at) ? new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const firstItemSeg = safe(getFirstInvoiceLineDescriptionForFilename(data));
  const downloadName = `${safe(statusLabel)}_${safe(invoice.invoice_number)}_${safe(ownerName)}_${firstItemSeg}_${dateOrder}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(buf);
});

/**
 * GET /api/v1/invoices/:id/archive
 * Download ZIP berisi: invoice PDF per status (dari riwayat: tagihan DP, pembayaran DP, lunas, dll) + bukti bayar + bukti refund.
 * Urutan: file invoice dari yang terdahulu lalu terbaru, kemudian bukti bayar, lalu bukti refund.
 * HotelProgress tidak memuat kolom hotel_document_url di query (kolom opsional, migration 20260310000001); arsip hotel tetap pakai generate slip jika room+meal selesai.
 */
const getArchive = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id, {
    include: [
      { model: Order, as: 'Order', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'], required: false }, { model: OrderItem, as: 'OrderItems', attributes: ['id', 'order_id', 'type', 'quantity', 'subtotal', 'manifest_file_url', 'jamaah_data_type', 'jamaah_data_value', 'meta'], include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type', 'meta'], required: false }, { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'meal_status', 'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time', 'notes'] }, { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at', 'notes'] }, { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at', 'notes'] }, { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'bus_ticket_info', 'arrival_status', 'departure_status', 'return_status', 'notes'] }] }] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] },
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount', 'proof_file_url'], order: [['created_at', 'DESC']] },
      { model: PaymentReallocation, as: 'ReallocationsOut', required: false, include: [{ model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number'] }] },
      { model: PaymentReallocation, as: 'ReallocationsIn', required: false, include: [{ model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number'] }] }
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

  const data = invoice.toJSON();
  const effectiveRates = await getEffectiveKursForInvoice(invoice, invoice.Order);
  data.currency_rates = effectiveRates;
  data.currency_rates_override = effectiveRates;
  data.BalanceAllocations = await loadBalanceAllocationsForInvoicePdf(invoice.id);
  await attachResolvedBankAccountsForPdf(data, invoice);
  const safe = (s) => (String(s || '').replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim() || 'invoice');
  const invNum = invoice.invoice_number || 'INV';
  const ownerName = (invoice.User && (invoice.User.name || invoice.User.company_name)) || invoice.owner_name_manual || invoice.Order?.owner_name_manual || 'Owner';
  const archiveFirstItemSeg = safe(getFirstInvoiceLineDescriptionForFilename(data));

  // Riwayat status invoice (urutan: dari yang terdahulu ke terbaru) untuk generate PDF per tahap
  const statusHistoryRows = await InvoiceStatusHistory.findAll({
    where: { invoice_id: invoice.id },
    order: [['changed_at', 'ASC']],
    attributes: ['to_status', 'from_status', 'changed_at']
  });
  const statusesOrdered = [];
  const seen = new Set();
  for (const row of statusHistoryRows) {
    if (row.from_status && !seen.has(row.from_status)) {
      statusesOrdered.push(row.from_status);
      seen.add(row.from_status);
    }
    if (row.to_status && !seen.has(row.to_status)) {
      statusesOrdered.push(row.to_status);
      seen.add(row.to_status);
    }
  }
  if (statusesOrdered.length === 0) statusesOrdered.push(data.status || invoice.status);

  res.setHeader('Content-Type', 'application/zip');
  const zipFileName = `Invoice_${safe(invNum)}_${safe(ownerName)}.zip`;
  res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    logger.error('Invoice archive error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Gagal membuat arsip' });
  });
  archive.pipe(res);

  const invoiceEntryNames = [];
  for (let i = 0; i < statusesOrdered.length; i++) {
    const status = statusesOrdered[i];
    const dataForStatus = { ...data, status };
    const label = getEffectiveStatusLabel(dataForStatus);
    const buf = await buildInvoicePdfBuffer(dataForStatus);
    const entryName = `01_Invoice_${String(i + 1).padStart(2, '0')}_${safe(invNum)}_${safe(label)}_${archiveFirstItemSeg}.pdf`;
    invoiceEntryNames.push(entryName);
    archive.append(buf, { name: entryName });
  }

  // Helper: URL relatif (/uploads/xxx atau xxx) -> path absolut (abaikan http/https). Dipakai untuk arsip dan manifest/visa/tiket.
  const resolveUploadPath = (url) => {
    if (!url || typeof url !== 'string') return null;
    const u = url.replace(/\\/g, '/').trim();
    if (/^https?:\/\//i.test(u)) return null;
    const norm = u.replace(/^\/?uploads\/?/i, '').replace(/^\/+/, '');
    if (!norm) return null;
    return path.join(UPLOAD_ROOT, norm);
  };

  const proofDir = uploadConfig.getDir(uploadConfig.SUBDIRS.PAYMENT_PROOFS);
  const proofs = invoice.PaymentProofs || [];
  proofs.forEach((proof, idx) => {
    const url = (proof.proof_file_url || '').trim();
    if (!url || url === 'issued-saudi') return;
    const match = url.replace(/\\/g, '/').match(/payment-proofs\/?(.+)$/i);
    const filename = match ? match[1].replace(/^\/+/, '').split('/').pop() : path.basename(url);
    if (!filename) return;
    let filePath = path.join(proofDir, filename);
    if (!fs.existsSync(filePath)) filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
    if (filePath && fs.existsSync(filePath)) {
      archive.file(filePath, { name: `02_Bukti_Bayar_${String(idx + 1).padStart(2, '0')}_${path.basename(filePath)}` });
    }
  });

  const refundDir = uploadConfig.getDir(uploadConfig.SUBDIRS.REFUND_PROOFS || 'refund-proofs');
  const refunds = invoice.Refunds || [];
  refunds.forEach((r, idx) => {
    const url = (r.proof_file_url || '').trim();
    if (!url) return;
    const match = url.replace(/\\/g, '/').match(/refund-proofs\/?(.+)$/i);
    const filename = match ? match[1].replace(/^\/+/, '').split('/').pop() : path.basename(url);
    if (!filename) return;
    let filePath = path.join(refundDir, filename);
    if (!fs.existsSync(filePath)) filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
    if (filePath && fs.existsSync(filePath)) {
      archive.file(filePath, { name: `03_Bukti_Refund_${String(idx + 1).padStart(2, '0')}_${path.basename(filePath)}` });
    }
  });

  const order = invoice.Order;
  const orderItems = (order && order.OrderItems) || [];
  const slipOpts = { order, invoice: invoice.get ? invoice.get({ plain: true }) : invoice };
  let manifestIdx = 0;
  let visaIdx = 0;
  let tiketIdx = 0;

  // 04_Manifest_* : file manifest jamaah (upload owner/tim invoice)
  orderItems.forEach((item) => {
    const url = (item.manifest_file_url || '').trim();
    if (!url) return;
    const filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
    if (!filePath || !fs.existsSync(filePath)) return;
    const filename = path.basename(filePath);
    const typeLabel = (item.type || 'item').toLowerCase().includes('visa') ? 'Visa' : (item.type || '').toLowerCase().includes('ticket') || (item.type || '').toLowerCase().includes('tiket') ? 'Tiket' : 'Manifest';
    manifestIdx += 1;
    archive.file(filePath, { name: `04_Manifest_${String(manifestIdx).padStart(2, '0')}_${typeLabel}_${filename}` });
  });

  // 05_Visa_* : dokumen visa terbit (upload divisi visa)
  orderItems.forEach((item) => {
    const prog = item.VisaProgress;
    const url = (prog && prog.visa_file_url) ? (prog.visa_file_url || '').trim() : '';
    if (!url) return;
    const filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
    if (!filePath || !fs.existsSync(filePath)) return;
    const filename = path.basename(filePath);
    visaIdx += 1;
    archive.file(filePath, { name: `05_Visa_${String(visaIdx).padStart(2, '0')}_${filename}` });
  });

  // 06_Tiket_* : dokumen tiket terbit (upload divisi tiket)
  orderItems.forEach((item) => {
    const prog = item.TicketProgress;
    const url = (prog && prog.ticket_file_url) ? (prog.ticket_file_url || '').trim() : '';
    if (!url) return;
    const filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
    if (!filePath || !fs.existsSync(filePath)) return;
    const filename = path.basename(filePath);
    tiketIdx += 1;
    archive.file(filePath, { name: `06_Tiket_${String(tiketIdx).padStart(2, '0')}_${filename}` });
  });

  // 07_Jamaah_* : file data jamaah (ZIP/link dari owner/invoice) jika berupa path file
  orderItems.forEach((item, idx) => {
    if ((item.jamaah_data_type || '').toLowerCase() !== 'file') return;
    const val = (item.jamaah_data_value || '').trim();
    if (!val) return;
    const filePath = val.startsWith('/') || /^[a-zA-Z]:\\/.test(val) ? val : resolveUploadPath(val.startsWith('uploads/') ? val : `uploads/${val}`);
    if (!filePath || !fs.existsSync(filePath)) return;
    const filename = path.basename(filePath);
    archive.file(filePath, { name: `07_Jamaah_${String(idx + 1).padStart(2, '0')}_${filename}` });
  });

  // 08_Hotel_* : slip/dokumen info hotel (file tersimpan atau generate on-the-fly setelah penetapan room + selesai makan)
  let hotelIdx = 0;
  for (const item of orderItems) {
    if ((item.type || '').toLowerCase() !== 'hotel') continue;
    const prog = item.HotelProgress;
    if (!prog) continue;
    const url = (prog.hotel_document_url || '').trim();
    const hasRoom = !!((prog.room_number || '').trim());
    const mealDone = (prog.meal_status || '').toLowerCase() === 'completed';
    if (url) {
      const filePath = resolveUploadPath(url.startsWith('/') ? url : `uploads/${url}`);
      if (filePath && fs.existsSync(filePath)) {
        hotelIdx += 1;
        archive.file(filePath, { name: `08_Hotel_${String(hotelIdx).padStart(2, '0')}_${path.basename(filePath)}` });
        continue;
      }
    }
    if (hasRoom && mealDone) {
      try {
        const itemWithOrder = { ...(item.get ? item.get({ plain: true }) : item), Order: order || item.Order };
        const buf = await buildHotelInfoPdfBuffer(itemWithOrder, slipOpts);
        hotelIdx += 1;
        const ordNum = (invoice.Order && invoice.Order.order_number) || 'ORD';
        const name = `08_Hotel_${String(hotelIdx).padStart(2, '0')}_Slip_${(ordNum || '').replace(/[^a-zA-Z0-9-]/g, '_')}_${(item.id || '').toString().slice(-6)}.pdf`;
        archive.append(buf, { name });
      } catch (e) {
        logger.warn('Archive hotel slip generate failed:', e && e.message);
      }
    }
  }

  // 09_Slip_Visa_* : slip informasi visa (generate on-the-fly)
  let visaSlipIdx = 0;
  for (const item of orderItems) {
    if ((item.type || '').toLowerCase() !== 'visa') continue;
    try {
      const buf = await buildVisaSlipPdfBuffer(item, slipOpts);
      visaSlipIdx += 1;
      const ordNum = (invoice.Order && invoice.Order.order_number) || 'ORD';
      const name = `09_Slip_Visa_${String(visaSlipIdx).padStart(2, '0')}_${(ordNum || '').replace(/[^a-zA-Z0-9-]/g, '_')}_${(item.id || '').toString().slice(-6)}.pdf`;
      archive.append(buf, { name });
    } catch (e) {
      logger.warn('Archive visa slip generate failed:', e && e.message);
    }
  }

  // 10_Slip_Tiket_* : slip informasi tiket (generate on-the-fly)
  let tiketSlipIdx = 0;
  for (const item of orderItems) {
    if ((item.type || '').toLowerCase() !== 'ticket') continue;
    try {
      const buf = await buildTicketSlipPdfBuffer(item, slipOpts);
      tiketSlipIdx += 1;
      const ordNum = (invoice.Order && invoice.Order.order_number) || 'ORD';
      const name = `10_Slip_Tiket_${String(tiketSlipIdx).padStart(2, '0')}_${(ordNum || '').replace(/[^a-zA-Z0-9-]/g, '_')}_${(item.id || '').toString().slice(-6)}.pdf`;
      archive.append(buf, { name });
    } catch (e) {
      logger.warn('Archive ticket slip generate failed:', e && e.message);
    }
  }

  // 11_Slip_Bus_* : slip informasi bus (generate on-the-fly)
  let busSlipIdx = 0;
  for (const item of orderItems) {
    if ((item.type || '').toLowerCase() !== 'bus') continue;
    try {
      const buf = await buildBusSlipPdfBuffer(item, slipOpts);
      busSlipIdx += 1;
      const ordNum = (invoice.Order && invoice.Order.order_number) || 'ORD';
      const name = `11_Slip_Bus_${String(busSlipIdx).padStart(2, '0')}_${(ordNum || '').replace(/[^a-zA-Z0-9-]/g, '_')}_${(item.id || '').toString().slice(-6)}.pdf`;
      archive.append(buf, { name });
    } catch (e) {
      logger.warn('Archive bus slip generate failed:', e && e.message);
    }
  }

  const readmeLines = [
    `Arsip Dokumen Invoice: ${invNum}`,
    `Owner: ${ownerName}`,
    `Tanggal: ${(invoice.issued_at || invoice.created_at) ? new Date(invoice.issued_at || invoice.created_at).toLocaleString('id-ID') : '-'}`,
    '',
    'Isi arsip:',
    ...invoiceEntryNames.map((name, i) => `- ${name} : Invoice PDF (tahap ${i + 1})`),
    '- 02_Bukti_Bayar_* : Bukti pembayaran (owner/tim invoice)',
    ...refunds.filter((r) => r.proof_file_url).map((r, i) => `- 03_Bukti_Refund_${String(i + 1).padStart(2, '0')}_* : Bukti refund ${i + 1}`),
    '- 04_Manifest_* : Manifest jamaah (upload owner/tim invoice)',
    '- 05_Visa_* : Dokumen visa terbit (upload divisi visa)',
    '- 06_Tiket_* : Dokumen tiket terbit (upload divisi tiket)',
    '- 07_Jamaah_* : File data jamaah (jika ada)',
    '- 08_Hotel_* : Slip/info hotel (auto setelah penetapan room + selesai makan)',
    '- 09_Slip_Visa_* : Slip informasi visa',
    '- 10_Slip_Tiket_* : Slip informasi tiket',
    '- 11_Slip_Bus_* : Slip informasi bus',
    '',
    'Dibuat dari menu Detail Invoice.'
  ];
  archive.append(readmeLines.join('\r\n'), { name: 'README.txt' });

  await archive.finalize();
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
  const ordForPic = await Order.findByPk(order.id, { attributes: ['pic_name'] });
  const picPatch = {};
  if (ordForPic?.pic_name && String(ordForPic.pic_name).trim()) {
    picPatch.pic_name = String(ordForPic.pic_name).trim();
  }
  await updateInvoiceWithAudit(invoice, {
    total_amount: newTotal,
    total_amount_idr: totalAmountIdr,
    total_amount_sar: totalAmountSar,
    dp_amount: dpAmount,
    remaining_amount: remainingAmount,
    overpaid_amount: overpaidAmount,
    status: newStatus,
    ...picPatch,
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
 * Cek apakah user boleh mengakses invoice untuk reallocation (sumber atau target).
 */
async function canAccessInvoiceForReallocation(invoiceId, user) {
  const invoice = await Invoice.findByPk(invoiceId, { attributes: ['id', 'owner_id', 'branch_id', 'order_id'] });
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

/** Resolve URL relatif upload (/uploads/xxx) ke path absolut di server */
function resolveUploadFilePath(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.replace(/\\/g, '/').trim();
  if (/^https?:\/\//i.test(u)) return null;
  const norm = u.replace(/^\/?uploads\/?/i, '').replace(/^\/+/, '');
  if (!norm) return null;
  return path.join(UPLOAD_ROOT, norm);
}

/**
 * GET /api/v1/invoices/:id/order-items/:orderItemId/ticket-file
 * Unduh dokumen tiket terbit (ZIP/RAR) — stream dari server agar path konsisten.
 */
const getTicketFile = asyncHandler(async (req, res) => {
  let access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok && (req.user.role === ROLES.TIKET_KOORDINATOR || req.user.role === ROLES.SUPER_ADMIN)) {
    const inv = await Invoice.findByPk(req.params.id, { attributes: ['id', 'order_id'], include: [{ model: Order, as: 'Order', attributes: ['branch_id'] }] });
    if (inv?.Order?.branch_id) {
      const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
      if (req.user.branch_id === inv.Order.branch_id || (branchIds && branchIds.length > 0 && branchIds.includes(inv.Order.branch_id))) {
        access = { ok: true, invoice: await Invoice.findByPk(req.params.id, { attributes: ['id', 'owner_id', 'branch_id', 'order_id'] }) };
      }
    }
  }
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const invoice = access.invoice;
  const orderItem = await OrderItem.findOne({
    where: { id: req.params.orderItemId, order_id: invoice.order_id },
    include: [{ model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'ticket_file_url'] }]
  });
  if (!orderItem || !orderItem.TicketProgress || !orderItem.TicketProgress.ticket_file_url) {
    return res.status(404).json({ success: false, message: 'Dokumen tiket tidak ditemukan' });
  }
  const filePath = resolveUploadFilePath(orderItem.TicketProgress.ticket_file_url);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File tidak tersedia di server' });
  }
  const filename = path.basename(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/v1/invoices/:id/order-items/:orderItemId/manifest-file
 * Unduh file manifest jamaah (upload owner/tim invoice) — stream dari server seperti invoice/visa/tiket.
 */
const getManifestFile = asyncHandler(async (req, res) => {
  const access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const invoice = access.invoice;
  const orderItem = await OrderItem.findOne({
    where: { id: req.params.orderItemId, order_id: invoice.order_id },
    attributes: ['id', 'manifest_file_url', 'type']
  });
  if (!orderItem || !orderItem.manifest_file_url || !(orderItem.manifest_file_url || '').trim()) {
    return res.status(404).json({ success: false, message: 'File manifest tidak ditemukan' });
  }
  const filePath = resolveUploadFilePath((orderItem.manifest_file_url || '').trim());
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File tidak tersedia di server' });
  }
  const filename = path.basename(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/v1/invoices/:id/order-items/:orderItemId/visa-file
 * Unduh dokumen visa terbit — stream dari server agar path konsisten.
 */
const getVisaFile = asyncHandler(async (req, res) => {
  let access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok && (req.user.role === ROLES.VISA_KOORDINATOR || req.user.role === ROLES.SUPER_ADMIN)) {
    const inv = await Invoice.findByPk(req.params.id, { attributes: ['id', 'order_id'], include: [{ model: Order, as: 'Order', attributes: ['branch_id'] }] });
    if (inv?.Order?.branch_id) {
      const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
      if (req.user.branch_id === inv.Order.branch_id || (branchIds && branchIds.length > 0 && branchIds.includes(inv.Order.branch_id))) {
        access = { ok: true, invoice: await Invoice.findByPk(req.params.id, { attributes: ['id', 'owner_id', 'branch_id', 'order_id'] }) };
      }
    }
  }
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const invoice = access.invoice;
  const orderItem = await OrderItem.findOne({
    where: { id: req.params.orderItemId, order_id: invoice.order_id },
    include: [{ model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'visa_file_url'] }]
  });
  if (!orderItem || !orderItem.VisaProgress || !orderItem.VisaProgress.visa_file_url) {
    return res.status(404).json({ success: false, message: 'Dokumen visa tidak ditemukan' });
  }
  const filePath = resolveUploadFilePath(orderItem.VisaProgress.visa_file_url);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File tidak tersedia di server' });
  }
  const filename = path.basename(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/v1/invoices/:id/order-items/:orderItemId/siskopatuh-file
 * Unduh dokumen siskopatuh (upload divisi setelah status selesai) — path di OrderItem.meta.siskopatuh_file_url
 */
const getSiskopatuhFile = asyncHandler(async (req, res) => {
  let access = await canAccessInvoiceForReallocation(req.params.id, req.user);
  if (!access.ok && req.user.role === ROLES.ROLE_SISKOPATUH) {
    const inv = await Invoice.findByPk(req.params.id, { attributes: ['id', 'owner_id', 'branch_id', 'order_id'] });
    if (inv?.branch_id) {
      const rows = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
      const ids = rows.map((r) => r.id);
      if (ids.includes(inv.branch_id)) {
        access = { ok: true, invoice: inv };
      }
    }
  }
  if (!access.ok) return res.status(403).json({ success: false, message: access.message });
  const invoice = access.invoice;
  const orderItem = await OrderItem.findOne({
    where: { id: req.params.orderItemId, order_id: invoice.order_id, type: ORDER_ITEM_TYPE.SISKOPATUH },
    attributes: ['id', 'meta']
  });
  if (!orderItem) {
    return res.status(404).json({ success: false, message: 'Item siskopatuh tidak ditemukan' });
  }
  const meta = orderItem.meta && typeof orderItem.meta === 'object' ? orderItem.meta : {};
  const fileUrl = (meta.siskopatuh_file_url || '').trim();
  if (!fileUrl) {
    return res.status(404).json({ success: false, message: 'Dokumen siskopatuh belum diupload' });
  }
  const filePath = resolveUploadFilePath(fileUrl);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File tidak tersedia di server' });
  }
  const filename = path.basename(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
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
  exportListExcel,
  exportListPdf,
  listDraftOrders,
  getSummary,
  create,
  createInvoiceForOrder,
  getById,
  getPdf,
  getArchive,
  unblock,
  verifyPayment,
  handleOverpaid,
  allocateBalance,
  ensureBlockedStatus,
  syncInvoiceFromOrder,
  listReallocations,
  getStatusHistory,
  getOrderRevisions,
  sendPaymentReceivedNotificationEmail,
  getTicketFile,
  getVisaFile,
  getSiskopatuhFile,
  getManifestFile
};
