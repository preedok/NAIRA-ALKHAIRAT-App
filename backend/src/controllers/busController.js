const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Order,
  OrderItem,
  User,
  Branch,
  Product,
  ProductPrice,
  BusProgress
} = require('../models');
const { ORDER_ITEM_TYPE, BUS_TICKET_STATUS, BUS_TRIP_STATUS } = require('../constants');

/**
 * GET /api/v1/bus/dashboard
 * Rekapitulasi pekerjaan bus: total order, item bus, per status tiket/kedatangan/keberangkatan/kepulangan.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role bus harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
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
        where: { type: ORDER_ITEM_TYPE.BUS },
        required: true,
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ]
  });

  let totalBusItems = 0;
  let ticketPending = 0;
  let ticketIssued = 0;
  const arrivalCounts = { pending: 0, scheduled: 0, completed: 0 };
  const departureCounts = { pending: 0, scheduled: 0, completed: 0 };
  const returnCounts = { pending: 0, scheduled: 0, completed: 0 };
  const pendingList = [];

  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      totalBusItems += 1;
      const prog = item.BusProgress;
      const ticketStatus = prog?.bus_ticket_status || BUS_TICKET_STATUS.PENDING;
      if (ticketStatus === BUS_TICKET_STATUS.PENDING) ticketPending += 1;
      else ticketIssued += 1;
      const arr = prog?.arrival_status || BUS_TRIP_STATUS.PENDING;
      const dep = prog?.departure_status || BUS_TRIP_STATUS.PENDING;
      const ret = prog?.return_status || BUS_TRIP_STATUS.PENDING;
      arrivalCounts[arr] = (arrivalCounts[arr] || 0) + 1;
      departureCounts[dep] = (departureCounts[dep] || 0) + 1;
      returnCounts[ret] = (returnCounts[ret] || 0) + 1;
      const allDone = ticketStatus === BUS_TICKET_STATUS.ISSUED && arr === BUS_TRIP_STATUS.COMPLETED && dep === BUS_TRIP_STATUS.COMPLETED && ret === BUS_TRIP_STATUS.COMPLETED;
      if (!allDone) {
        pendingList.push({
          order_id: o.id,
          order_number: o.order_number,
          order_item_id: item.id,
          owner_name: o.User?.name,
          quantity: item.quantity,
          bus_ticket_status: ticketStatus,
          arrival_status: arr,
          departure_status: dep,
          return_status: ret
        });
      }
    });
  });

  res.json({
    success: true,
    data: {
      total_orders: orders.length,
      total_bus_items: totalBusItems,
      bus_ticket: { pending: ticketPending, issued: ticketIssued },
      arrival: arrivalCounts,
      departure: departureCounts,
      return: returnCounts,
      pending_list: pendingList.slice(0, 50)
    }
  });
});

/**
 * GET /api/v1/bus/orders
 * List orders that have bus items (current branch).
 */
const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role bus harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
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
        where: { type: ORDER_ITEM_TYPE.BUS },
        required: true,
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ],
    order: [['created_at', 'DESC']]
  });

  res.json({ success: true, data: orders });
});

/**
 * GET /api/v1/bus/orders/:id
 * Order detail with bus items and progress.
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
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (order.branch_id !== branchId) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });
  const busItems = (order.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.BUS);
  if (busItems.length === 0) return res.status(404).json({ success: false, message: 'Order tidak memiliki item bus' });

  res.json({ success: true, data: order });
});

/**
 * GET /api/v1/bus/products
 * Produk bus dengan harga: general (pusat), cabang (admin cabang), khusus (role invoice per owner). Read-only.
 */
const listProducts = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  const products = await Product.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS, is_active: true },
    include: [
      { model: ProductPrice, as: 'ProductPrices', required: false, include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'company_name'], required: false }] }
    ],
    order: [['code', 'ASC']]
  });

  const result = products.map(p => {
    const prices = p.ProductPrices || [];
    const general = prices.find(pr => !pr.branch_id && !pr.owner_id);
    const branch = branchId ? prices.find(pr => pr.branch_id === branchId && !pr.owner_id) : null;
    const specialPrices = prices.filter(pr => pr.owner_id).map(pr => ({
      owner_id: pr.owner_id,
      owner_name: pr.Owner?.name || pr.Owner?.company_name || '-',
      amount: parseFloat(pr.amount),
      currency: pr.currency
    }));
    return {
      ...p.toJSON(),
      price_general: general ? parseFloat(general.amount) : null,
      price_branch: branch ? parseFloat(branch.amount) : null,
      currency: general?.currency || branch?.currency || 'IDR',
      special_prices: specialPrices
    };
  });

  res.json({ success: true, data: result });
});

/**
 * PATCH /api/v1/bus/order-items/:orderItemId/progress
 * Update: tiket bis (status + info), status kedatangan, keberangkatan, kepulangan, notes.
 */
const updateItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { bus_ticket_status, bus_ticket_info, arrival_status, departure_status, return_status, notes } = req.body;

  const item = await OrderItem.findByPk(orderItemId, {
    include: [{ model: Order, as: 'Order' }, { model: BusProgress, as: 'BusProgress', required: false }]
  });
  if (!item || item.type !== ORDER_ITEM_TYPE.BUS) return res.status(404).json({ success: false, message: 'Order item bus tidak ditemukan' });
  if (item.Order.branch_id !== req.user.branch_id) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });

  const validTicket = Object.values(BUS_TICKET_STATUS);
  const validTrip = Object.values(BUS_TRIP_STATUS);
  if (bus_ticket_status && !validTicket.includes(bus_ticket_status)) return res.status(400).json({ success: false, message: 'Status tiket bus tidak valid' });
  if (arrival_status && !validTrip.includes(arrival_status)) return res.status(400).json({ success: false, message: 'Status kedatangan tidak valid' });
  if (departure_status && !validTrip.includes(departure_status)) return res.status(400).json({ success: false, message: 'Status keberangkatan tidak valid' });
  if (return_status && !validTrip.includes(return_status)) return res.status(400).json({ success: false, message: 'Status kepulangan tidak valid' });

  let progress = item.BusProgress;
  if (!progress) {
    progress = await BusProgress.create({
      order_item_id: item.id,
      bus_ticket_status: bus_ticket_status || BUS_TICKET_STATUS.PENDING,
      bus_ticket_info: bus_ticket_info || null,
      arrival_status: arrival_status || BUS_TRIP_STATUS.PENDING,
      departure_status: departure_status || BUS_TRIP_STATUS.PENDING,
      return_status: return_status || BUS_TRIP_STATUS.PENDING,
      notes: notes || null,
      updated_by: req.user.id
    });
  } else {
    const updates = { updated_by: req.user.id };
    if (bus_ticket_status !== undefined) updates.bus_ticket_status = bus_ticket_status;
    if (bus_ticket_info !== undefined) updates.bus_ticket_info = bus_ticket_info;
    if (arrival_status !== undefined) updates.arrival_status = arrival_status;
    if (departure_status !== undefined) updates.departure_status = departure_status;
    if (return_status !== undefined) updates.return_status = return_status;
    if (notes !== undefined) updates.notes = notes;
    await progress.update(updates);
  }

  const updated = await BusProgress.findByPk(progress.id);
  res.json({ success: true, data: updated });
});

/**
 * GET /api/v1/bus/export-excel
 * Export rekap pekerjaan bus ke Excel (lengkap dan detail).
 */
const exportExcel = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role bus harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
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
        where: { type: ORDER_ITEM_TYPE.BUS },
        required: true,
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ],
    order: [['order_number', 'ASC']]
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bintang Global - Role Bus';
  const sheet = workbook.addWorksheet('Rekap Bus', { headerFooter: { firstHeader: 'Rekap Pekerjaan Bus' } });

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Order Number', key: 'order_number', width: 20 },
    { header: 'Owner', key: 'owner_name', width: 25 },
    { header: 'Qty', key: 'quantity', width: 6 },
    { header: 'Tiket Bis', key: 'bus_ticket_status', width: 12 },
    { header: 'Info Tiket', key: 'bus_ticket_info', width: 25 },
    { header: 'Kedatangan', key: 'arrival_status', width: 12 },
    { header: 'Keberangkatan', key: 'departure_status', width: 14 },
    { header: 'Kepulangan', key: 'return_status', width: 12 },
    { header: 'Catatan', key: 'notes', width: 30 }
  ];
  sheet.getRow(1).font = { bold: true };

  let no = 1;
  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      const prog = item.BusProgress;
      sheet.addRow({
        no: no++,
        order_number: o.order_number,
        owner_name: o.User?.name || '',
        quantity: item.quantity,
        bus_ticket_status: prog?.bus_ticket_status || BUS_TICKET_STATUS.PENDING,
        bus_ticket_info: prog?.bus_ticket_info || '',
        arrival_status: prog?.arrival_status || BUS_TRIP_STATUS.PENDING,
        departure_status: prog?.departure_status || BUS_TRIP_STATUS.PENDING,
        return_status: prog?.return_status || BUS_TRIP_STATUS.PENDING,
        notes: prog?.notes || ''
      });
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=rekap-bus-${Date.now()}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/v1/bus/export-pdf
 * Export rekap pekerjaan bus ke PDF (lengkap dan detail).
 */
const exportPdf = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role bus harus terikat cabang' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
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
        where: { type: ORDER_ITEM_TYPE.BUS },
        required: true,
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ],
    order: [['order_number', 'ASC']]
  });

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=rekap-bus-${Date.now()}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).text('Rekap Pekerjaan Bus', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown(2);

  const rows = [];
  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      const prog = item.BusProgress;
      rows.push({
        order: o.order_number,
        owner: o.User?.name || '',
        qty: item.quantity,
        ticket: prog?.bus_ticket_status || BUS_TICKET_STATUS.PENDING,
        info: (prog?.bus_ticket_info || '').substring(0, 20),
        arrival: prog?.arrival_status || BUS_TRIP_STATUS.PENDING,
        departure: prog?.departure_status || BUS_TRIP_STATUS.PENDING,
        return: prog?.return_status || BUS_TRIP_STATUS.PENDING
      });
    });
  });

  const tableTop = doc.y;
  const colWidths = { no: 25, order: 80, owner: 90, qty: 30, ticket: 45, info: 60, arrival: 45, departure: 50, return: 45 };
  const headers = ['No', 'Order', 'Owner', 'Qty', 'Tiket', 'Info', 'Kedatangan', 'Keberangkatan', 'Kepulangan'];
  doc.font('Helvetica-Bold').fontSize(9);
  let x = 50;
  Object.keys(colWidths).forEach((k, i) => {
    doc.text(headers[i], x, tableTop, { width: colWidths[k] });
    x += colWidths[k];
  });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8);

  rows.forEach((row, idx) => {
    const y = doc.y;
    if (y > 700) {
      doc.addPage();
      doc.y = 50;
    }
    const rowY = doc.y;
    x = 50;
    doc.text(String(idx + 1), x, rowY, { width: colWidths.no }); x += colWidths.no;
    doc.text((row.order || '').substring(0, 12), x, rowY, { width: colWidths.order }); x += colWidths.order;
    doc.text((row.owner || '').substring(0, 14), x, rowY, { width: colWidths.owner }); x += colWidths.owner;
    doc.text(String(row.qty), x, rowY, { width: colWidths.qty }); x += colWidths.qty;
    doc.text(row.ticket, x, rowY, { width: colWidths.ticket }); x += colWidths.ticket;
    doc.text(row.info, x, rowY, { width: colWidths.info }); x += colWidths.info;
    doc.text(row.arrival, x, rowY, { width: colWidths.arrival }); x += colWidths.arrival;
    doc.text(row.departure, x, rowY, { width: colWidths.departure }); x += colWidths.departure;
    doc.text(row.return, x, rowY, { width: colWidths.return });
    doc.moveDown(0.4);
  });

  doc.end();
});

module.exports = {
  getDashboard,
  listOrders,
  getOrder,
  listProducts,
  updateItemProgress,
  exportExcel,
  exportPdf
};
