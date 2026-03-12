const fs = require('fs');
const path = require('path');
const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Branch, Provinsi, Wilayah, Product, ProductPrice, VisaProgress, TicketProgress, HotelProgress, BusProgress, Invoice, Refund, PaymentReallocation, PaymentProof, Bank, AccountingBankAccount, OwnerProfile } = require('../models');
const PAYMENT_PROOF_ATTRS = ['id', 'invoice_id', 'payment_type', 'amount', 'payment_currency', 'amount_original', 'amount_idr', 'amount_sar', 'bank_id', 'bank_name', 'account_number', 'sender_account_name', 'sender_account_number', 'recipient_bank_account_id', 'transfer_date', 'proof_file_url', 'uploaded_by', 'verified_by', 'verified_at', 'verified_status', 'notes', 'issued_by', 'payment_location', 'reconciled_at', 'reconciled_by', 'created_at', 'updated_at'];
const { ORDER_ITEM_TYPE, ROLES, INVOICE_STATUS } = require('../constants');
const { HOTEL_PROGRESS_STATUS } = require('../constants');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const uploadConfig = require('../config/uploads');
const { buildHotelInfoPdfBuffer } = require('../utils/hotelPdf');

/** Default jam check-in 16:00, check-out 12:00 (otomatis sistem, tidak perlu pilih jam) */
const DEFAULT_CHECK_IN_TIME = '16:00';
const DEFAULT_CHECK_OUT_TIME = '12:00';

/**
 * Hitung jamaah_status dari tanggal + jam check-in/check-out vs now.
 * Returns: 'belum_masuk' | 'sudah_masuk_room' | 'keluar_room'
 */
function getJamaahStatus(checkInDate, checkOutDate, checkInTime, checkOutTime) {
  if (!checkInDate || !checkOutDate) return null;
  const ciTime = (checkInTime || DEFAULT_CHECK_IN_TIME).toString().trim() || DEFAULT_CHECK_IN_TIME;
  const coTime = (checkOutTime || DEFAULT_CHECK_OUT_TIME).toString().trim() || DEFAULT_CHECK_OUT_TIME;
  const parse = (dateStr, timeStr) => {
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10) || 0);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const now = Date.now();
  const ci = parse(checkInDate, ciTime);
  const co = parse(checkOutDate, coTime);
  if (now < ci) return 'belum_masuk';
  if (now < co) return 'sudah_masuk_room';
  return 'keluar_room';
}

/** Attach jamaah_status to hotel item from meta + HotelProgress (auto dari tanggal & jam check-in/check-out). */
function attachJamaahStatus(item) {
  const meta = item.meta || {};
  const prog = item.HotelProgress;
  const checkInDate = prog?.check_in_date || meta.check_in;
  const checkOutDate = prog?.check_out_date || meta.check_out;
  const checkInTime = prog?.check_in_time || meta.check_in_time;
  const checkOutTime = prog?.check_out_time || meta.check_out_time;
  const status = getJamaahStatus(checkInDate, checkOutDate, checkInTime, checkOutTime);
  if (status) {
    item.jamaah_status = status;
    if (prog) prog.jamaah_status = status;
  }
  return item;
}

/**
 * Hotel controller: scope cabang via getHotelBranchIds (sama seperti bus/tiket).
 * branch_id user TIDAK wajib: super_admin = semua cabang, koordinator (invoice/tiket/visa) = wilayah,
 * role_hotel tanpa cabang/wilayah = fallback semua cabang. Tidak ada pesan "Role hotel harus terikat cabang".
 */
const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
/** Scope cabang: super_admin = semua cabang, koordinator = wilayah, role hotel = cabang/wilayah. Fallback semua cabang agar tidak 403. */
async function getHotelBranchIds(user) {
  if (user.role === ROLES.SUPER_ADMIN) {
    const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
    return branches.map(b => b.id);
  }
  if (KOORDINATOR_ROLES.includes(user.role) && user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  if (user.branch_id) return [user.branch_id];
  if (user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
  return branches.map(b => b.id);
}

/**
 * GET /api/v1/hotel/invoices
 * List invoices that have hotel items (scope cabang). Sama pola dengan visa/ticket/bus.
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIdsFromHotel = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromHotel.length === 0) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } });

  const where = { order_id: { [Op.in]: orderIdsFromHotel }, branch_id: { [Op.in]: branchIds } };
  // Tampilkan invoice yang sudah ada pembayaran DP (status partial_paid ke atas) — pakai status invoice sebagai sumber kebenaran
  const statusesForProgress = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  if (status && statusesForProgress.includes(status)) {
    where.status = status;
  } else {
    where.status = { [Op.in]: statusesForProgress };
  }
  // Progress: jangan tampilkan invoice yang sudah dibatalkan atau sudah direfund
  const refundedInvoiceIds = await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }).then(rows => rows.map(r => r.invoice_id).filter(Boolean));
  if (refundedInvoiceIds.length > 0) where.id = { [Op.notIn]: refundedInvoiceIds };
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({ status: { [Op.notIn]: [INVOICE_STATUS.CANCELED, INVOICE_STATUS.CANCELLED_REFUND] } });

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const count = await Invoice.count({ where });
  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'owner_id', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at', 'currency_rates_override', 'penalty_amount', 'waive_bus_penalty', 'bus_include_arrival_status', 'bus_include_arrival_bus_number', 'bus_include_arrival_date', 'bus_include_arrival_time', 'bus_include_return_status', 'bus_include_return_bus_number', 'bus_include_return_date', 'bus_include_return_time'],
        include: [
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.HOTEL },
            required: true,
            include: [
              { model: HotelProgress, as: 'HotelProgress', required: false },
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type', 'meta'], required: false }
            ]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset
  });

  const orderIdsFromInvoices = [...new Set((invoices || []).map((i) => i.order_id).filter(Boolean))];
  let orderItemsByOrderId = {};
  if (orderIdsFromInvoices.length > 0) {
    const allItemTypes = [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS, ORDER_ITEM_TYPE.HANDLING, ORDER_ITEM_TYPE.PACKAGE];
    const fullItems = await OrderItem.findAll({
      where: { order_id: orderIdsFromInvoices, type: { [Op.in]: allItemTypes } },
      include: [
        { model: VisaProgress, as: 'VisaProgress', required: false },
        { model: TicketProgress, as: 'TicketProgress', required: false },
        { model: HotelProgress, as: 'HotelProgress', required: false },
        { model: BusProgress, as: 'BusProgress', required: false },
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type', 'meta'], required: false }
      ],
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta']
    });
    fullItems.forEach((it) => {
      const oid = it.order_id;
      if (!orderItemsByOrderId[oid]) orderItemsByOrderId[oid] = [];
      const plain = it.get ? it.get({ plain: true }) : it;
      plain.product_name = (plain.Product && plain.Product.name) ? plain.Product.name : null;
      plain.product_type = plain.type || (plain.Product && plain.Product.type) || null;
      orderItemsByOrderId[oid].push(plain);
    });
  }

  // Attach hotel_location ke tiap item hotel (dari Product.meta.location atau infer dari nama) agar filter tab Mekkah/Madinah jalan
  const inferLocationFromName = (name) => {
    if (!name || typeof name !== 'string') return '';
    const n = name.toLowerCase().trim();
    if (/madinah/.test(n)) return 'madinah';
    if (/mekkah|makkah/.test(n)) return 'makkah';
    return '';
  };
  let data = invoices.map((inv) => {
    const plain = inv.get ? inv.get({ plain: true }) : inv;
    const fullItems = orderItemsByOrderId[plain.order_id] || [];
    if (plain.Order) plain.Order.OrderItems = fullItems;
    (fullItems || []).filter((oi) => (oi.type || '').toLowerCase() === 'hotel').forEach((oi) => {
      let loc = (oi.Product?.meta && oi.Product.meta.location != null) ? String(oi.Product.meta.location).trim() : '';
      if (!loc) loc = inferLocationFromName(oi.Product?.name);
      oi.hotel_location = loc ? loc.toLowerCase() : '';
    });
    return plain;
  });

  const invoiceIds = data.map((d) => d.id).filter(Boolean);
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
    data = data.map((d) => ({ ...d, ReallocationsOut: outByInvId[d.id] || [], ReallocationsIn: inByInvId[d.id] || [] }));
  }

  const totalPages = Math.ceil((count || 0) / lim) || 1;
  res.json({ success: true, data, pagination: { total: count || 0, page: pg, limit: lim, totalPages } });
});

/**
 * GET /api/v1/hotel/invoices/:id
 * Detail invoice dengan item hotel dan progress.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const invoice = await Invoice.findByPk(req.params.id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: PaymentReallocation, as: 'ReallocationsOut', required: false, include: [{ model: Invoice, as: 'TargetInvoice', attributes: ['id', 'invoice_number'] }], order: [['created_at', 'DESC']] },
      { model: PaymentReallocation, as: 'ReallocationsIn', required: false, include: [{ model: Invoice, as: 'SourceInvoice', attributes: ['id', 'invoice_number'] }], order: [['created_at', 'DESC']] },
      {
        model: Order,
        as: 'Order',
        include: [
          { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
          { model: Branch, as: 'Branch' },
          {
            model: OrderItem,
            as: 'OrderItems',
            include: [
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'meta'], required: false },
              { model: HotelProgress, as: 'HotelProgress', required: false }
            ]
          }
        ]
      }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang/wilayah Anda' });
  const allowedStatuses = [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  if (!invoice.status || !allowedStatuses.includes(invoice.status)) {
    return res.status(403).json({ success: false, message: 'Invoice tidak tersedia untuk divisi hotel.' });
  }
  const hotelItems = (invoice.Order?.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  if (hotelItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item hotel' });
  hotelItems.forEach(attachJamaahStatus);

  const data = invoice.get ? invoice.get({ plain: true }) : invoice;
  const inferLocFromName = (name) => {
    if (!name || typeof name !== 'string') return '';
    const n = String(name).toLowerCase().trim();
    if (/madinah/.test(n)) return 'madinah';
    if (/mekkah|makkah/.test(n)) return 'makkah';
    return '';
  };
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.HOTEL && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
      let loc = (p.meta && p.meta.location != null) ? String(p.meta.location).trim() : '';
      if (!loc) loc = inferLocFromName(p.name);
      oi.hotel_location = loc ? loc.toLowerCase() : '';
    }
  });

  res.json({ success: true, data });
});

/**
 * GET /api/v1/hotel/orders
 * List orders that have hotel items (for current user branch). Role hotel only.
 */
const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIdsFromHotel = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromHotel.length === 0) return res.json({ success: true, data: [] });

  // Acuan data order/transaksi: hanya order yang punya invoice (GET mengacu data invoice)
  const invoices = await Invoice.findAll({
    where: { order_id: { [Op.in]: orderIdsFromHotel }, branch_id: { [Op.in]: branchIds } },
    attributes: ['order_id'],
    raw: true
  });
  const orderIds = [...new Set(invoices.map(i => i.order_id))];
  if (orderIds.length === 0) return res.json({ success: true, data: [] });

  const where = { id: orderIds, branch_id: { [Op.in]: branchIds } };
  if (status) where.status = status;

  const orders = await Order.findAll({
    where,
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: true },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.HOTEL },
        required: true,
        include: [{ model: HotelProgress, as: 'HotelProgress', required: false }]
      }
    ],
    order: [['created_at', 'DESC']]
  });

  res.json({ success: true, data: orders });
});

/**
 * GET /api/v1/hotel/orders/:id
 * Order detail with hotel items and progress (for role hotel).
 */
const getOrder = asyncHandler(async (req, res) => {
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  // Acuan data order: hanya order yang punya invoice (GET mengacu data invoice)
  const order = await Order.findOne({
    where: { id: req.params.id },
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: true },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch' },
      {
        model: OrderItem,
        as: 'OrderItems',
        include: [{ model: HotelProgress, as: 'HotelProgress', required: false }]
      }
    ]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (!branchIds.includes(order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });
  const hotelItems = (order.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  if (hotelItems.length === 0) return res.status(404).json({ success: false, message: 'Order tidak memiliki item hotel' });
  hotelItems.forEach(attachJamaahStatus);

  res.json({ success: true, data: order });
});

/**
 * GET /api/v1/hotel/products
 * Product hotel (dan makan dari meta) - informasi ketersediaan & harga (read-only). General, cabang, invoice.
 */
const listProducts = asyncHandler(async (req, res) => {
  const branchIds = await getHotelBranchIds(req.user);
  const branchId = branchIds[0] || req.user.branch_id; // untuk tampilan harga cabang
  const products = await Product.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL, is_active: true },
    include: [{ model: ProductPrice, as: 'ProductPrices', required: false }],
    order: [['code', 'ASC']]
  });

  const result = products.map(p => {
    const prices = p.ProductPrices || [];
    const general = prices.find(pr => !pr.branch_id && !pr.owner_id);
    const branch = branchId ? prices.find(pr => pr.branch_id === branchId && !pr.owner_id) : null;
    const withOwner = prices.filter(pr => pr.owner_id);
    return {
      ...p.toJSON(),
      price_general: general ? parseFloat(general.amount) : null,
      price_branch: branch ? parseFloat(branch.amount) : null,
      currency: general?.currency || branch?.currency || 'IDR',
      special_prices_count: withOwner.length
    };
  });

  res.json({ success: true, data: result });
});

/**
 * GET /api/v1/hotel/dashboard
 * Rekapitulasi pekerjaan role hotel: total, per status, list pending.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const statusWithDpPaidList = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];

  const orders = await Order.findAll({
    where: { id: orderIds, branch_id: { [Op.in]: branchIds } },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: false },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.HOTEL },
        required: true,
        include: [{ model: HotelProgress, as: 'HotelProgress', required: false }]
      }
    ]
  });

  let totalHotelItems = 0;
  let totalOrdersWithDpPaid = 0;
  const byStatus = { waiting_confirmation: 0, confirmed: 0, room_assigned: 0, completed: 0 };
  const pendingRoom = [];

  orders.forEach(o => {
    const inv = o.Invoice;
    const invoiceHasDpPaid = inv && inv.status && statusWithDpPaidList.includes(inv.status);
    if (invoiceHasDpPaid) totalOrdersWithDpPaid += 1;
    (o.OrderItems || []).forEach(item => {
      if (!invoiceHasDpPaid) return;
      totalHotelItems += 1;
      const prog = item.HotelProgress;
      const status = prog?.status || HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION;
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status !== HOTEL_PROGRESS_STATUS.COMPLETED && status !== HOTEL_PROGRESS_STATUS.ROOM_ASSIGNED) {
        pendingRoom.push({
          order_id: o.id,
          invoice_id: inv?.id || null,
          invoice_number: inv?.invoice_number || null,
          order_item_id: item.id,
          owner_name: o.User?.name,
          product_ref_id: item.product_ref_id,
          quantity: item.quantity,
          meta: item.meta,
          status,
          room_number: prog?.room_number
        });
      }
    });
  });

  res.json({
    success: true,
    data: {
      total_orders: totalOrdersWithDpPaid,
      total_hotel_items: totalHotelItems,
      by_status: byStatus,
      pending_room_allocation: pendingRoom.slice(0, 20)
    }
  });
});

/**
 * PATCH /api/v1/hotel/order-items/:orderItemId/progress
 * Update status pekerjaan hotel: status, room_number, meal_status. Role hotel only.
 */
const updateItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { status, room_number, meal_status, check_in_date, check_out_date, notes } = req.body;
  // Jam check-in/check-out otomatis sistem (16:00 / 12:00), tidak dari body

  const item = await OrderItem.findByPk(orderItemId, {
    include: [{ model: Order, as: 'Order' }, { model: HotelProgress, as: 'HotelProgress', required: false }]
  });
  if (!item || item.type !== ORDER_ITEM_TYPE.HOTEL) return res.status(404).json({ success: false, message: 'Order item hotel tidak ditemukan' });
  const branchIdsProgress = await getHotelBranchIds(req.user);
  if (branchIdsProgress.length === 0 || !branchIdsProgress.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

  const validStatuses = Object.values(HOTEL_PROGRESS_STATUS);
  if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });

  const meta = item.meta || {};
  let progress = item.HotelProgress;
  if (!progress) {
    progress = await HotelProgress.create({
      order_item_id: item.id,
      status: status || HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION,
      check_in_date: check_in_date ?? meta.check_in,
      check_out_date: check_out_date ?? meta.check_out,
      check_in_time: DEFAULT_CHECK_IN_TIME,
      check_out_time: DEFAULT_CHECK_OUT_TIME,
      updated_by: req.user.id
    });
  } else {
    const updates = { updated_by: req.user.id };
    if (status !== undefined) updates.status = status;
    if (room_number !== undefined) updates.room_number = room_number;
    if (meal_status !== undefined) updates.meal_status = ['pending', 'confirmed', 'completed'].includes(meal_status) ? meal_status : progress.meal_status;
    if (check_in_date !== undefined) updates.check_in_date = check_in_date;
    if (check_out_date !== undefined) updates.check_out_date = check_out_date;
    updates.check_in_time = DEFAULT_CHECK_IN_TIME;
    updates.check_out_time = DEFAULT_CHECK_OUT_TIME;
    if (notes !== undefined) updates.notes = notes;
    await progress.update(updates);
  }

  let updated = await HotelProgress.findByPk(progress.id);

  // Auto-generate dokumen info hotel saat nomor room terisi dan status makan = Selesai (completed)
  const effectiveRoom = (updated.room_number || '').trim();
  const effectiveMeal = updated.meal_status || 'pending';
  if (effectiveRoom && effectiveMeal === 'completed') {
    try {
      const fullItem = await OrderItem.findByPk(orderItemId, {
        include: [
          { model: Order, as: 'Order', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] },
          { model: Product, as: 'Product', attributes: ['id', 'code', 'name'] },
          { model: HotelProgress, as: 'HotelProgress', required: false }
        ]
      });
      if (fullItem && fullItem.HotelProgress) {
        const buf = await buildHotelInfoPdfBuffer(fullItem);
        const orderNumber = fullItem.Order?.order_number || 'ORD';
        const fileName = uploadConfig.hotelDocFilename(orderNumber, fullItem.id);
        const dir = uploadConfig.getDir(uploadConfig.SUBDIRS.HOTEL_DOCS);
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, buf, 'binary');
        const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.HOTEL_DOCS, fileName);
        try {
          await updated.update({ hotel_document_url: fileUrl });
        } catch (colErr) {
          // Kolom hotel_document_url mungkin belum ada di DB (migration 20260310000001 belum dijalankan). Abaikan agar PATCH tetap 200.
        }
        updated = await HotelProgress.findByPk(progress.id);
      }
    } catch (e) {
      // Jangan gagalkan response; dokumen bisa digenerate ulang
      if (typeof console !== 'undefined' && console.warn) console.warn('Hotel doc generate failed:', e && e.message);
    }
  }

  res.json({ success: true, data: updated });
});

/**
 * GET /api/v1/hotel/invoices/:id/order-items/:orderItemId/slip
 * Unduh/tampilkan slip PDF info hotel untuk satu order item. Tampilkan ketika status selesai (completed/room_assigned + meal completed).
 */
const getOrderItemSlip = asyncHandler(async (req, res) => {
  const { id: invoiceId, orderItemId } = req.params;
  const branchIds = await getHotelBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif.' });

  const invoice = await Invoice.findByPk(invoiceId, { attributes: ['id', 'order_id', 'branch_id', 'invoice_number'] });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang/wilayah Anda' });

  const item = await OrderItem.findOne({
    where: { id: orderItemId, order_id: invoice.order_id, type: ORDER_ITEM_TYPE.HOTEL },
    include: [
      { model: Order, as: 'Order', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name'] },
      { model: HotelProgress, as: 'HotelProgress', required: false }
    ]
  });
  if (!item) return res.status(404).json({ success: false, message: 'Item hotel tidak ditemukan' });

  const buf = await buildHotelInfoPdfBuffer(item, { invoice: { invoice_number: invoice.invoice_number } });
  const invNum = (invoice.invoice_number || 'INV').replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `Slip_Hotel_${invNum}_${String(orderItemId).slice(-6)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buf);
});

module.exports = {
  listInvoices,
  getInvoice,
  listOrders,
  getOrder,
  listProducts,
  getDashboard,
  updateItemProgress,
  getOrderItemSlip
};
