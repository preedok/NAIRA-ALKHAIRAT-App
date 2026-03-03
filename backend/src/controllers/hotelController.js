const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Branch, Product, ProductPrice, HotelProgress, Invoice } = require('../models');
const { ORDER_ITEM_TYPE, ROLES, INVOICE_STATUS } = require('../constants');
const { HOTEL_PROGRESS_STATUS } = require('../constants');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');

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

  const where = { order_id: orderIdsFromHotel, branch_id: { [Op.in]: branchIds } };
  // Hanya tampilkan invoice dengan status pembayaran_dp (sudah ada bukti bayar DP) di menu Progress hotel
  const { DP_PAYMENT_STATUS } = require('../constants');
  const ordersWithDpPaid = await Order.findAll({
    where: { id: orderIdsFromHotel, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
    attributes: ['id'],
    raw: true
  }).then(rows => rows.map(r => r.id));
  where.order_id = ordersWithDpPaid.length ? { [Op.in]: ordersWithDpPaid } : { [Op.in]: [] };
  const statusesForProgress = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  if (status && statusesForProgress.includes(status)) {
    where.status = status;
  } else {
    where.status = { [Op.in]: statusesForProgress };
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const count = await Invoice.count({ where });
  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'order_number', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at'],
        include: [
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.HOTEL },
            required: true,
            include: [
              { model: HotelProgress, as: 'HotelProgress', required: false },
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }
            ]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset
  });

  const totalPages = Math.ceil((count || 0) / lim) || 1;
  res.json({ success: true, data: invoices, pagination: { total: count || 0, page: pg, limit: lim, totalPages } });
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
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false },
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
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.HOTEL && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
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

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const where = { id: orderIds, branch_id: { [Op.in]: branchIds } };
  if (status) where.status = status;

  const orders = await Order.findAll({
    where,
    include: [
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

  const order = await Order.findByPk(req.params.id, {
    include: [
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
          order_number: o.order_number,
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

  const updated = await HotelProgress.findByPk(progress.id);
  res.json({ success: true, data: updated });
});

module.exports = {
  listInvoices,
  getInvoice,
  listOrders,
  getOrder,
  listProducts,
  getDashboard,
  updateItemProgress
};
