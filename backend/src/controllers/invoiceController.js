const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const asyncHandler = require('express-async-handler');
const sequelize = require('../config/sequelize');
const { Invoice, InvoiceFile, Order, OrderItem, User, Branch, PaymentProof, Notification, Provinsi, Wilayah, Product, VisaProgress, TicketProgress, HotelProgress, BusProgress, Refund, OwnerProfile, OwnerBalanceTransaction, PaymentReallocation, AccountingBankAccount } = require('../models');
const { INVOICE_STATUS, NOTIFICATION_TRIGGER, ORDER_ITEM_TYPE } = require('../constants');
const { getRulesForBranch } = require('./businessRuleController');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');

const KOORDINATOR_ROLES = ['admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'];
function isKoordinatorRole(role) {
  return KOORDINATOR_ROLES.includes(role);
}
const { buildInvoicePdfBuffer } = require('../utils/invoicePdf');
const { SUBDIRS, getDir, invoiceFilename, toUrlPath } = require('../config/uploads');

const generateInvoiceNumber = () => {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 99999) + 1;
  return `INV-${y}-${String(n).padStart(5, '0')}`;
};

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
 * GET /api/v1/invoices
 */
const ALLOWED_SORT = ['invoice_number', 'created_at', 'total_amount', 'status'];

async function resolveBranchFilterList(branch_id, provinsi_id, wilayah_id, user) {
  if (!user) return branch_id ? { branch_id } : {};
  // Role invoice Saudi: lihat semua invoice seluruh wilayah (filter branch hanya jika dikirim eksplisit)
  if (user.role === 'role_invoice_saudi') return branch_id ? { branch_id } : {};
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
      return { branch_id: { [Op.in]: [] } };
    }
    if (user.branch_id) return { branch_id: user.branch_id };
    return {};
  }
  // Owner: jangan scope by branch di sini agar mereka lihat semua invoice milik mereka
  if (user.role === 'owner') return branch_id ? { branch_id } : {};
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
  const { status, branch_id, provinsi_id, wilayah_id, owner_id, order_status, invoice_number, order_number, date_from, date_to, due_status, limit = 25, page = 1, sort_by, sort_order } = req.query;
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
    if (due_status === 'current') {
      where.due_date_dp = { [Op.gt]: endOfToday };
    } else if (due_status === 'due') {
      where.due_date_dp = { [Op.between]: [startOfToday, endOfToday] };
    } else if (due_status === 'overdue') {
      where.due_date_dp = { [Op.lt]: startOfToday };
      where.remaining_amount = { [Op.gt]: 0 };
    }
  }
  if (req.user.role === 'owner') where.owner_id = req.user.id;
  // Role hotel: hanya tampilkan invoice yang order-nya punya item hotel (pekerjaan hotel di menu Invoice).
  if (req.user.role === 'role_hotel') {
    const hotelRows = await OrderItem.findAll({ where: { type: 'hotel' }, attributes: ['order_id'], raw: true });
    const hotelOrderIds = [...new Set((hotelRows || []).map((r) => r.order_id))];
    where.order_id = hotelOrderIds.length ? { [Op.in]: hotelOrderIds } : { [Op.in]: [] };
  }
  // Role bus: hanya tampilkan invoice yang order-nya punya item bus (pekerjaan bus di menu Invoice).
  if (req.user.role === 'role_bus') {
    const busRows = await OrderItem.findAll({ where: { type: 'bus' }, attributes: ['order_id'], raw: true });
    const busOrderIds = [...new Set((busRows || []).map((r) => r.order_id))];
    where.order_id = busOrderIds.length ? { [Op.in]: busOrderIds } : { [Op.in]: [] };
  }
  // Untuk owner: jangan filter branch_id agar semua invoice milik mereka tampil (order bisa punya branch dari form).
  // role_accounting, role_invoice_saudi, role_hotel, role_bus: lihat invoice sesuai scope.
  if (req.user.branch_id && req.user.role !== 'owner' && req.user.role !== 'role_hotel' && req.user.role !== 'role_bus' && !['super_admin', 'admin_pusat', 'role_accounting', 'role_invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }

  const orderInclude = {
    model: Order,
    as: 'Order',
    attributes: ['id', 'order_number', 'total_amount', 'currency', 'status', 'created_at', 'currency_rates_override'],
    include: [
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS] } },
        required: false,
        attributes: ['id', 'type', 'quantity'],
        include: [
          { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
          { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
          { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
          { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
        ]
      }
    ]
  };
  if (order_status || order_number) {
    orderInclude.required = true;
    orderInclude.where = {};
    if (order_status) orderInclude.where.status = order_status;
    if (order_number) orderInclude.where.order_number = { [Op.iLike]: `%${String(order_number).trim()}%` };
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  // Order by kolom Invoice saja (alias Sequelize = nama model)
  const orderBy = [[sequelize.literal('"Invoice"."' + sortCol + '"'), sortDir]];

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [
      orderInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }] }
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
    return plain;
  });

  const orderIdsFromRows = [...new Set(data.map((d) => d.order_id).filter(Boolean))];
  let orderItemsByOrderId = {};
  if (orderIdsFromRows.length > 0) {
    const items = await OrderItem.findAll({
      where: { order_id: orderIdsFromRows, type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS] } },
      include: [
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false },
        { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
        { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
        { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
        { model: BusProgress, as: 'BusProgress', required: false, attributes: ['id', 'bus_ticket_status', 'arrival_status', 'departure_status', 'return_status'] }
      ],
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'manifest_file_url', 'meta']
    });
    for (const it of items) {
      const oid = it.order_id;
      if (!orderItemsByOrderId[oid]) orderItemsByOrderId[oid] = [];
      orderItemsByOrderId[oid].push(it.get ? it.get({ plain: true }) : it);
    }
  }
  for (const d of data) {
    if (d.order_id) {
      if (!d.Order) d.Order = {};
      d.Order.OrderItems = orderItemsByOrderId[d.order_id] || [];
    }
  }

  const [totalAmount, totalPaid, totalRemaining, invoiceRows, orderRows] = await Promise.all([
    Invoice.sum('total_amount', { where }),
    Invoice.sum('paid_amount', { where }),
    Invoice.sum('remaining_amount', { where }),
    Invoice.findAll({ where, include: [orderInclude], attributes: ['status', 'order_id'], raw: true }),
    Invoice.findAll({
      where,
      include: [{ model: Order, as: 'Order', attributes: ['id', 'status'], required: !!(order_status || order_number), where: order_status || order_number ? (orderInclude.where || {}) : undefined }],
      attributes: ['order_id'],
      raw: true
    })
  ]);

  const orderIds = [...new Set((orderRows || []).map((r) => r.order_id).filter(Boolean))];
  const byInvoiceStatus = (invoiceRows || []).reduce((acc, r) => {
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

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    success: true,
    data,
    pagination: { total: count, page: pg, limit: lim, totalPages },
    summary: {
      total_invoices: count,
      total_orders: orderIds.length,
      total_amount: parseFloat(totalAmount || 0),
      total_paid: parseFloat(totalPaid || 0),
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
  if (req.user.role === 'owner') orderWhereDraft.owner_id = req.user.id;
  if (Object.keys(branchFilter).length) Object.assign(orderWhereDraft, branchFilter);
  if (req.user.role === 'role_hotel') {
    const hotelRows = await OrderItem.findAll({ where: { type: 'hotel' }, attributes: ['order_id'], raw: true });
    const hotelOrderIds = [...new Set((hotelRows || []).map((r) => r.order_id))].filter((id) => !withInvIds.includes(id));
    orderWhereDraft.id = hotelOrderIds.length ? { [Op.in]: hotelOrderIds } : { [Op.in]: [] };
  }
  if (req.user.role === 'role_bus') {
    const busRows = await OrderItem.findAll({ where: { type: 'bus' }, attributes: ['order_id'], raw: true });
    const busOrderIds = [...new Set((busRows || []).map((r) => r.order_id))].filter((id) => !withInvIds.includes(id));
    orderWhereDraft.id = busOrderIds.length ? { [Op.in]: busOrderIds } : { [Op.in]: [] };
  }
  const draftOrderInclude = [
    { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
    { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
    {
      model: OrderItem,
      as: 'OrderItems',
      where: { type: { [Op.in]: [ORDER_ITEM_TYPE.VISA, ORDER_ITEM_TYPE.TICKET, ORDER_ITEM_TYPE.HOTEL, ORDER_ITEM_TYPE.BUS] } },
      required: false,
      attributes: ['id', 'type', 'quantity'],
      include: [
        { model: VisaProgress, as: 'VisaProgress', required: false, attributes: ['id', 'status', 'visa_file_url', 'issued_at'] },
        { model: TicketProgress, as: 'TicketProgress', required: false, attributes: ['id', 'status', 'ticket_file_url', 'issued_at'] },
        { model: HotelProgress, as: 'HotelProgress', required: false, attributes: ['id', 'status', 'room_number', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time'] },
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
      Order: { ...plain, OrderItems: plain.OrderItems || [] },
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
  const { status, branch_id, owner_id, order_status, invoice_number, order_number, date_from, date_to, due_status } = req.query;
  const where = {};
  if (status) where.status = status;
  if (branch_id) where.branch_id = branch_id;
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
  if (req.user.role === 'owner') where.owner_id = req.user.id;
  if (req.user.branch_id && req.user.role !== 'owner' && !['super_admin', 'admin_pusat', 'role_accounting', 'role_invoice_saudi'].includes(req.user.role) && !isKoordinatorRole(req.user.role)) {
    where.branch_id = req.user.branch_id;
  }
  if (req.user.wilayah_id && isKoordinatorRole(req.user.role)) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (branchIds.length) where.branch_id = { [Op.in]: branchIds };
    else where.branch_id = { [Op.in]: [] };
  }

  const orderInclude = { model: Order, as: 'Order', attributes: ['id', 'status'] };
  if (order_status || order_number) {
    orderInclude.required = true;
    orderInclude.where = {};
    if (order_status) orderInclude.where.status = order_status;
    if (order_number) orderInclude.where.order_number = { [Op.iLike]: `%${String(order_number).trim()}%` };
  }

  const [totalInvoices, totalAmount, totalPaid, totalRemaining, invoiceRows, orderRows] = await Promise.all([
    Invoice.count({ where, include: [orderInclude], distinct: true }),
    Invoice.sum('total_amount', { where }),
    Invoice.sum('paid_amount', { where }),
    Invoice.sum('remaining_amount', { where }),
    Invoice.findAll({
      where,
      include: [orderInclude],
      attributes: ['status', 'order_id'],
      raw: true
    }),
    Invoice.findAll({
      where,
      include: [{ model: Order, as: 'Order', attributes: ['id', 'status'], required: !!(order_status || order_number), where: order_status || order_number ? (orderInclude.where || {}) : undefined }],
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

  res.json({
    success: true,
    data: {
      total_invoices: totalInvoices || 0,
      total_orders: totalOrders,
      total_amount: parseFloat(totalAmount || 0),
      total_paid: parseFloat(totalPaid || 0),
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
  if (order.owner_id !== req.user.id && !['invoice_koordinator', 'role_invoice_saudi', 'super_admin'].includes(req.user.role)) {
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

  const invoice = await Invoice.create({
    invoice_number: generateInvoiceNumber(),
    order_id: order.id,
    owner_id: order.owner_id,
    branch_id: order.branch_id,
    total_amount: totalAmount,
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

  await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice baru',
    message: `Invoice ${invoice.invoice_number} untuk order ${order.order_number}. Silakan bayar DP dalam ${dpGraceHours} jam.`,
    data: { order_id: order.id, invoice_id: invoice.id }
  });

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
  const invoice = await Invoice.create({
    invoice_number: generateInvoiceNumber(),
    order_id: orderId,
    owner_id: order.owner_id,
    branch_id: order.branch_id,
    total_amount: totalAmount,
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
  await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice baru',
    message: `Invoice ${invoice.invoice_number} untuk order ${order.order_number || orderId}. Silakan bayar DP dalam ${dpGraceHours} jam.`,
    data: { order_id: orderId, invoice_id: invoice.id }
  });
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
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: PaymentProof, as: 'PaymentProofs', include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }] },
      { model: Refund, as: 'Refunds', required: false, order: [['created_at', 'DESC']] }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (req.user.role === 'owner' && invoice.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  if (isKoordinatorRole(req.user.role)) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
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
  // Sinkronkan paid_amount dari jumlah semua bukti terverifikasi (KES + transfer) jika tidak sesuai
  const proofs = invoice.PaymentProofs || [];
  const verifiedSum = proofs
    .filter(p => p.verified_status === 'verified' || (p.verified_at != null && p.verified_status !== 'rejected'))
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const currentPaid = parseFloat(invoice.paid_amount) || 0;
  if (Math.abs(verifiedSum - currentPaid) > 0.01) {
    const totalInv = parseFloat(invoice.total_amount) || 0;
    const remaining = Math.max(0, totalInv - verifiedSum);
    let newStatus = invoice.status;
    if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
    else if ((parseFloat(invoice.dp_amount) || 0) > 0 && verifiedSum >= parseFloat(invoice.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    await invoice.update({ paid_amount: verifiedSum, remaining_amount: remaining, status: newStatus });
    invoice.paid_amount = verifiedSum;
    invoice.remaining_amount = remaining;
    invoice.status = newStatus;
  }
  const rules = await getRulesForBranch(invoice.branch_id);
  const data = invoice.toJSON();
  data.currency_rates = rules.currency_rates || {};
  // Rekening bank untuk pembayaran: dari Data Rekening Bank (accounting), agar owner/role lain dapat daftar tanpa akses API accounting
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
  if (!['invoice_koordinator', 'role_invoice_saudi', 'admin_koordinator', 'admin_pusat', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang mengaktifkan invoice' });
  }
  if (isKoordinatorRole(req.user.role) && invoice) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
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
  await Notification.create({
    user_id: invoice.owner_id,
    trigger: NOTIFICATION_TRIGGER.INVOICE_CREATED,
    title: 'Invoice diaktifkan kembali',
    message: `Invoice ${invoice.invoice_number} dapat dibayar kembali. Silakan upload bukti DP.`,
    data: { invoice_id: invoice.id }
  });
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
  const proof = await PaymentProof.findByPk(payment_proof_id);
  if (!proof || proof.invoice_id !== req.params.id) return res.status(404).json({ success: false, message: 'Bukti bayar tidak ditemukan' });
  // Hanya karyawan (bukan owner/pembeli) yang boleh verifikasi
  const allowedVerify = ['admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'role_invoice_saudi', 'role_accounting', 'super_admin'];
  if (!allowedVerify.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang verifikasi' });
  }
  const invoice = await Invoice.findByPk(proof.invoice_id);
  if (isKoordinatorRole(req.user.role) && invoice) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
  }
  if (isApproved) {
    await proof.update({ verified_by: req.user.id, verified_at: new Date(), verified_status: 'verified', notes: notes || proof.notes });
    const currentPaid = parseFloat(invoice.paid_amount) || 0;
    const newPaid = currentPaid + (parseFloat(proof.amount) || 0);
    const remaining = Math.max(0, (parseFloat(invoice.total_amount) || 0) - newPaid);
    let newStatus = invoice.status;
    if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
    else if ((parseFloat(invoice.dp_amount) || 0) > 0 && newPaid >= parseFloat(invoice.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
    await invoice.update({
      paid_amount: newPaid,
      remaining_amount: remaining,
      status: newStatus
    });
    if (newStatus === INVOICE_STATUS.PAID) {
      const order = await Order.findByPk(invoice.order_id);
      if (order && !['completed', 'cancelled'].includes(order.status)) {
        await order.update({ status: 'processing' });
      }
    }
    await Notification.create({
      user_id: invoice.owner_id,
      trigger: newStatus === INVOICE_STATUS.PAID ? NOTIFICATION_TRIGGER.LUNAS : NOTIFICATION_TRIGGER.DP_RECEIVED,
      title: newStatus === INVOICE_STATUS.PAID ? 'Invoice lunas' : 'DP diterima',
      message: `Pembayaran untuk ${invoice.invoice_number} telah diverifikasi.`,
      data: { invoice_id: invoice.id }
    });
  } else {
    const wasVerified = proof.verified_status === 'verified' || (proof.verified_at != null);
    await proof.update({ verified_status: 'rejected', verified_by: null, verified_at: null, notes: notes || proof.notes });
    if (wasVerified) {
      const newPaid = Math.max(0, (parseFloat(invoice.paid_amount) || 0) - (parseFloat(proof.amount) || 0));
      const remaining = Math.max(0, parseFloat(invoice.total_amount) - newPaid);
      let newStatus = INVOICE_STATUS.TENTATIVE;
      if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
      else if (parseFloat(invoice.dp_amount) > 0 && newPaid >= parseFloat(invoice.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      await invoice.update({ paid_amount: newPaid, remaining_amount: remaining, status: newStatus });
    }
  }
  const full = await Invoice.findByPk(invoice.id, { include: [{ model: PaymentProof, as: 'PaymentProofs', include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }] }] });
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
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Invoice bukan di wilayah Anda' });
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
      await target.update({
        paid_amount: newPaid,
        remaining_amount: remaining,
        status: remaining <= 0 ? INVOICE_STATUS.PAID : target.status
      });
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
  const canAllocate = req.user.role === 'owner' && invoice.owner_id === req.user.id ||
    ['invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
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
  await invoice.update({ paid_amount: newPaid, remaining_amount: newRemaining, status: newStatus });
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
      { model: Order, as: 'Order', attributes: ['id', 'order_number'] },
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
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }] }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (req.user.role === 'owner' && invoice.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  const data = invoice.toJSON();
  try {
    const rules = await getRulesForBranch(invoice.branch_id);
    data.currency_rates = rules.currency_rates || {};
  } catch (e) {
    data.currency_rates = {};
  }
  const buf = await buildInvoicePdfBuffer(data);

  // Simpan ke disk (local - uploads/invoices/)
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

  const downloadName = `invoice-${invoice.invoice_number}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.send(buf);
});

/**
 * Sinkronkan invoice dengan order setelah order (items/total) berubah.
 * Update total_amount, dp_amount, remaining_amount, status. paid_amount tidak berubah.
 */
async function syncInvoiceFromOrder(order) {
  const invoice = await Invoice.findOne({ where: { order_id: order.id } });
  if (!invoice) return null;
  const newTotal = parseFloat(order.total_amount) || 0;
  const dpPct = parseInt(invoice.dp_percentage, 10) || 30;
  const dpAmount = Math.round(newTotal * dpPct / 100);
  const paidAmount = parseFloat(invoice.paid_amount) || 0;
  let remainingAmount = newTotal - paidAmount;
  let overpaidAmount = 0;
  if (remainingAmount < 0) {
    overpaidAmount = Math.abs(remainingAmount);
    remainingAmount = 0;
  }
  let newStatus = invoice.status;
  if (remainingAmount <= 0) {
    newStatus = INVOICE_STATUS.PAID;
  } else if (paidAmount >= dpAmount) {
    newStatus = INVOICE_STATUS.PARTIAL_PAID;
  } else {
    newStatus = INVOICE_STATUS.TENTATIVE;
  }
  await invoice.update({
    total_amount: newTotal,
    dp_amount: dpAmount,
    remaining_amount: remainingAmount,
    overpaid_amount: overpaidAmount,
    status: newStatus
  });
  return invoice;
}

/**
 * Jumlah yang bisa dialihkan dari invoice: canceled = paid_amount; else overpaid_amount.
 */
function getReleasableAmount(invoice) {
  const status = (invoice.status || '').toLowerCase();
  const paid = parseFloat(invoice.paid_amount) || 0;
  const overpaid = parseFloat(invoice.overpaid_amount) || 0;
  if (status === 'canceled' || status === 'cancelled') return Math.max(0, paid);
  return Math.max(0, overpaid);
}

/**
 * Cek apakah user boleh mengakses invoice untuk reallocation (sumber atau target).
 */
async function canAccessInvoiceForReallocation(invoiceId, user) {
  const invoice = await Invoice.findByPk(invoiceId, { attributes: ['id', 'owner_id', 'branch_id'] });
  if (!invoice) return { ok: false, message: 'Invoice tidak ditemukan' };
  if (user.role === 'owner' && invoice.owner_id !== user.id) return { ok: false, message: 'Bukan invoice Anda' };
  if (isKoordinatorRole(user.role)) {
    const branchIds = await getBranchIdsForWilayah(user.wilayah_id);
    if (!branchIds.includes(invoice.branch_id)) return { ok: false, message: 'Invoice bukan di wilayah Anda' };
  }
  if (user.branch_id && !['super_admin', 'admin_pusat', 'role_accounting', 'invoice_koordinator', 'role_invoice_saudi', 'owner'].includes(user.role) && !isKoordinatorRole(user.role)) {
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
  const allowed = ['owner', 'invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'admin_koordinator', 'super_admin'];
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
    if (status === 'canceled' || status === 'cancelled') {
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
      const isCanceled = (inv.status || '').toLowerCase() === 'canceled' || (inv.status || '').toLowerCase() === 'cancelled';
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
      await inv.update({
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        overpaid_amount: newOverpaid,
        status: newStatus
      }, { transaction: tx });
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
      await inv.update({
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        status: newStatus
      }, { transaction: tx });
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
  const allowed = ['owner', 'invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'admin_koordinator', 'super_admin', 'role_accounting'];
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

  if (invoice_id && (req.user.role === 'owner')) {
    const inv = await Invoice.findByPk(invoice_id, { attributes: ['id', 'owner_id'] });
    if (!inv || inv.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Invoice bukan milik Anda' });
    }
  }
  if (invoice_id && isKoordinatorRole(req.user.role)) {
    const inv = await Invoice.findByPk(invoice_id, { attributes: ['id', 'branch_id'] });
    if (inv) {
      const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
      if (!branchIds.includes(inv.branch_id)) {
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
  const allowed = ['owner', 'invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'admin_koordinator', 'super_admin'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Tidak berwenang' });
  }
  const releasable = getReleasableAmount(invoice);
  res.json({ success: true, data: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, releasable_amount: releasable } });
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
  getReleasable
};
