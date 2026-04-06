const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Invoice, Product, Refund } = require('../models');
const { ORDER_ITEM_TYPE, INVOICE_STATUS, HANDLING_PROGRESS_STATUS } = require('../constants');

const statusWithDpPaidList = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];

/**
 * GET /api/v1/handling/dashboard
 * Rekapitulasi pekerjaan role handling: total item handling, per status (pending, in_progress, completed), list pending.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const { date_from, date_to } = req.query;
  const refundedInvoiceIds = new Set(
    (await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }))
      .map(r => r.invoice_id)
      .filter(Boolean)
  );

  const orderWhere = {};
  if (date_from || date_to) {
    orderWhere.created_at = {};
    if (date_from) orderWhere.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      orderWhere.created_at[Op.lte] = d;
    }
  }

  const orderItemRows = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.HANDLING },
    attributes: ['id', 'order_id', 'product_ref_id', 'quantity', 'meta'],
    include: [
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'owner_id', 'pic_name'],
        where: Object.keys(orderWhere).length > 0 ? orderWhere : undefined,
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'] },
          { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status', 'pic_name'], required: false }
        ],
        required: true
      },
      { model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false }
    ]
  });

  let totalHandlingItems = 0;
  const byStatus = { pending: 0, in_progress: 0, completed: 0 };
  const pendingList = [];
  const orderIdsWithDpPaid = new Set();

  const cancelledStatuses = ['canceled', 'cancelled', 'cancelled_refund'];
  orderItemRows.forEach((item) => {
    const inv = item.Order?.Invoice;
    if (!inv || !statusWithDpPaidList.includes(inv.status)) return;
    if (cancelledStatuses.includes((inv.status || '').toLowerCase())) return;
    if (refundedInvoiceIds.has(inv.id)) return;
    orderIdsWithDpPaid.add(item.Order?.id);
    totalHandlingItems += 1;
    const status = (item.meta && item.meta.handling_status) || HANDLING_PROGRESS_STATUS.PENDING;
    const norm = status === HANDLING_PROGRESS_STATUS.COMPLETED ? 'completed' : status === HANDLING_PROGRESS_STATUS.IN_PROGRESS ? 'in_progress' : 'pending';
    byStatus[norm] = (byStatus[norm] || 0) + 1;
    if (norm !== 'completed') {
      pendingList.push({
        order_id: item.Order?.id,
        invoice_id: inv?.id,
        invoice_number: inv?.invoice_number,
        order_item_id: item.id,
        owner_name: item.Order?.User?.name,
        pic_name: inv?.pic_name || item.Order?.pic_name || null,
        product_name: item.Product?.name || 'Handling',
        quantity: item.quantity,
        status: norm
      });
    }
  });

  res.json({
    success: true,
    data: {
      total_orders: orderIdsWithDpPaid.size,
      total_handling_items: totalHandlingItems,
      by_status: byStatus,
      pending_list: pendingList.slice(0, 50)
    }
  });
});

/**
 * PATCH /api/v1/handling/order-items/:orderItemId/progress
 * Update status pekerjaan handling (OrderItem.meta.handling_status). Role handling only.
 */
const updateOrderItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { handling_status } = req.body;

  const allowed = [HANDLING_PROGRESS_STATUS.PENDING, HANDLING_PROGRESS_STATUS.IN_PROGRESS, HANDLING_PROGRESS_STATUS.COMPLETED];
  if (!handling_status || !allowed.includes(handling_status)) {
    return res.status(400).json({ success: false, message: 'handling_status harus salah satu: pending, in_progress, completed' });
  }

  const item = await OrderItem.findOne({
    where: { id: orderItemId, type: ORDER_ITEM_TYPE.HANDLING }
  });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Order item handling tidak ditemukan.' });
  }

  const meta = item.meta && typeof item.meta === 'object' ? { ...item.meta } : {};
  meta.handling_status = handling_status;
  await item.update({ meta });

  res.json({
    success: true,
    data: { order_item_id: item.id, handling_status }
  });
});

module.exports = {
  getDashboard,
  updateOrderItemProgress
};
