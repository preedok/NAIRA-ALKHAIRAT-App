const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Branch, Product, ProductPrice, HotelProgress } = require('../models');
const { ORDER_ITEM_TYPE } = require('../constants');
const { HOTEL_PROGRESS_STATUS } = require('../constants');

/**
 * GET /api/v1/hotel/orders
 * List orders that have hotel items (for current user branch). Role hotel only.
 */
const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role hotel harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const where = { id: orderIds, branch_id: branchId };
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
  const branchId = req.user.branch_id;
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
  if (order.branch_id !== branchId) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });
  const hotelItems = (order.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  if (hotelItems.length === 0) return res.status(404).json({ success: false, message: 'Order tidak memiliki item hotel' });

  res.json({ success: true, data: order });
});

/**
 * GET /api/v1/hotel/products
 * Product hotel (dan makan dari meta) - informasi ketersediaan & harga (read-only). General, cabang, invoice.
 */
const listProducts = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
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
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role hotel harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HOTEL },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const orders = await Order.findAll({
    where: { id: orderIds, branch_id: branchId },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
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
  const byStatus = { waiting_confirmation: 0, confirmed: 0, room_assigned: 0, completed: 0 };
  const pendingRoom = [];

  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      totalHotelItems += 1;
      const prog = item.HotelProgress;
      const status = prog?.status || HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION;
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status !== HOTEL_PROGRESS_STATUS.COMPLETED && status !== HOTEL_PROGRESS_STATUS.ROOM_ASSIGNED) {
        pendingRoom.push({
          order_id: o.id,
          order_number: o.order_number,
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
      total_orders: orders.length,
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

  const item = await OrderItem.findByPk(orderItemId, {
    include: [{ model: Order, as: 'Order' }, { model: HotelProgress, as: 'HotelProgress', required: false }]
  });
  if (!item || item.type !== ORDER_ITEM_TYPE.HOTEL) return res.status(404).json({ success: false, message: 'Order item hotel tidak ditemukan' });
  if (item.Order.branch_id !== req.user.branch_id) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });

  const validStatuses = Object.values(HOTEL_PROGRESS_STATUS);
  if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });

  let progress = item.HotelProgress;
  if (!progress) {
    progress = await HotelProgress.create({
      order_item_id: item.id,
      status: status || HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION,
      updated_by: req.user.id
    });
  } else {
    const updates = { updated_by: req.user.id };
    if (status !== undefined) updates.status = status;
    if (room_number !== undefined) updates.room_number = room_number;
    if (meal_status !== undefined) updates.meal_status = ['pending', 'confirmed', 'completed'].includes(meal_status) ? meal_status : progress.meal_status;
    if (check_in_date !== undefined) updates.check_in_date = check_in_date;
    if (check_out_date !== undefined) updates.check_out_date = check_out_date;
    if (notes !== undefined) updates.notes = notes;
    await progress.update(updates);
  }

  const updated = await HotelProgress.findByPk(progress.id);
  res.json({ success: true, data: updated });
});

module.exports = {
  listOrders,
  getOrder,
  listProducts,
  getDashboard,
  updateItemProgress
};
