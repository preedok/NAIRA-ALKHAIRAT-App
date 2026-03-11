const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  User,
  Branch,
  Provinsi,
  Wilayah,
  Product,
  ProductPrice,
  BusProgress,
  Invoice,
  Refund,
  PaymentReallocation
} = require('../models');
const { ORDER_ITEM_TYPE, BUS_TICKET_STATUS, BUS_TRIP_STATUS, ROLES, INVOICE_STATUS, DP_PAYMENT_STATUS } = require('../constants');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const { buildBusSlipPdfBuffer } = require('../utils/busSlipPdf');

const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
/** Scope cabang: super_admin = semua cabang, koordinator = wilayah, role bus = cabang/wilayah. Fallback semua cabang agar tidak 403. */
async function getBusBranchIds(user) {
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
 * GET /api/v1/bus/dashboard
 * Rekapitulasi pekerjaan bus: total order, item bus, per status tiket/kedatangan/keberangkatan/kepulangan.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  // Hanya order yang sudah ada pembayaran DP (sama seperti list Invoice/Progress bus)
  const orders = await Order.findAll({
    where: { id: orderIds, branch_id: { [Op.in]: branchIds }, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], required: false },
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
        const inv = o.Invoice;
        pendingList.push({
          order_id: o.id,
          invoice_id: inv?.id,
          invoice_number: inv?.invoice_number || null,
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
 * GET /api/v1/bus/invoices
 * List invoice yang punya order bus ATAU order visa (bus besar include dengan visa; order visa tetap relevan untuk menu bus/penalti).
 * Scope cabang role bus. Sama pola dengan visa/ticket.
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const [busRows, visaRows] = await Promise.all([
    OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.BUS }, attributes: ['order_id'], raw: true }),
    OrderItem.findAll({ where: { type: ORDER_ITEM_TYPE.VISA }, attributes: ['order_id'], raw: true })
  ]);
  const orderIdsFromBus = [...new Set(busRows.map(r => r.order_id))];
  const orderIdsFromVisa = [...new Set(visaRows.map(r => r.order_id))];
  const orderIdsRelevant = [...new Set([...orderIdsFromBus, ...orderIdsFromVisa])];

  if (orderIdsRelevant.length === 0) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } });

  const { DP_PAYMENT_STATUS } = require('../constants');
  const ordersWithDpPaid = await Order.findAll({
    where: { id: orderIdsRelevant, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
    attributes: ['id'],
    raw: true
  }).then(rows => rows.map(r => r.id));
  const where = { order_id: ordersWithDpPaid.length ? { [Op.in]: ordersWithDpPaid } : { [Op.in]: [] }, branch_id: { [Op.in]: branchIds } };
  const statusesForProgress = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  if (status && statusesForProgress.includes(status)) {
    where.status = status;
  } else {
    where.status = { [Op.in]: statusesForProgress };
  }
  // Progress: jangan tampilkan invoice yang sudah dibatalkan atau sudah direfund (hanya nilai enum yang ada di DB)
  const refundedInvoiceIds = await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }).then(rows => rows.map(r => r.invoice_id).filter(Boolean));
  if (refundedInvoiceIds.length > 0) where.id = { [Op.notIn]: refundedInvoiceIds };
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({ status: { [Op.notIn]: [INVOICE_STATUS.CANCELED, INVOICE_STATUS.CANCELLED_REFUND] } });

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const { count, rows: invoices } = await Invoice.findAndCountAll({
    where,
    include: [
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'owner_id', 'order_number', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at'],
        include: [
          { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.BUS },
            required: false,
            include: [
              { model: BusProgress, as: 'BusProgress', required: false },
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }
            ]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset,
    distinct: true
  });

  const invoiceIds = (invoices || []).map((i) => i.id).filter(Boolean);
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
    for (const inv of invoices) {
      inv.setDataValue('ReallocationsOut', outByInvId[inv.id] || []);
      inv.setDataValue('ReallocationsIn', inByInvId[inv.id] || []);
    }
  }

  const totalPages = Math.ceil((count || 0) / lim) || 1;
  res.json({ success: true, data: invoices, pagination: { total: count || 0, page: pg, limit: lim, totalPages } });
});

/**
 * GET /api/v1/bus/invoices/:id
 * Detail invoice dengan item bus dan progress.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchIds = await getBusBranchIds(req.user);
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
              { model: BusProgress, as: 'BusProgress', required: false },
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }
            ]
          }
        ]
      }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang/wilayah Anda' });
  const busItems = (invoice.Order?.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.BUS);
  if (busItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item bus' });

  const data = invoice.get ? invoice.get({ plain: true }) : invoice;
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.BUS && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
    }
  });
  res.json({ success: true, data: data || invoice });
});

/**
 * GET /api/v1/bus/orders
 * List orders that have bus items (current branch).
 */
const listOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIdsFromBus = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromBus.length === 0) return res.json({ success: true, data: [] });

  // Acuan data order/transaksi: hanya order yang punya invoice (GET mengacu data invoice)
  const invoices = await Invoice.findAll({
    where: { order_id: { [Op.in]: orderIdsFromBus }, branch_id: { [Op.in]: branchIds } },
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
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: true, include: [{ model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] }] },
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
  const branchIds = await getBusBranchIds(req.user);
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
        include: [{ model: BusProgress, as: 'BusProgress', required: false }]
      }
    ]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (!branchIds.includes(order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });
  const busItems = (order.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.BUS);
  if (busItems.length === 0) return res.status(404).json({ success: false, message: 'Order tidak memiliki item bus' });

  res.json({ success: true, data: order });
});

/**
 * GET /api/v1/bus/products
 * Produk bus dengan harga: general (pusat), cabang (admin cabang), khusus (role invoice per owner). Read-only.
 */
const listProducts = asyncHandler(async (req, res) => {
  const branchIds = await getBusBranchIds(req.user);
  const branchId = branchIds[0] || req.user.branch_id; // untuk tampilan harga cabang
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
  const branchIdsProgress = await getBusBranchIds(req.user);
  if (branchIdsProgress.length === 0 || !branchIdsProgress.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

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
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const orders = await Order.findAll({
    where: { id: orderIds, branch_id: { [Op.in]: branchIds } },
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
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIds = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.BUS },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const orders = await Order.findAll({
    where: { id: orderIds, branch_id: { [Op.in]: branchIds } },
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

/**
 * GET /api/v1/bus/invoices/:id/order-items/:orderItemId/slip
 * Tampilkan slip PDF bus untuk satu order item. Tampilkan ketika status terbit (bus_ticket_status issued).
 */
const getOrderItemSlip = asyncHandler(async (req, res) => {
  const { id: invoiceId, orderItemId } = req.params;
  const branchIds = await getBusBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif.' });

  const invoice = await Invoice.findByPk(invoiceId, { attributes: ['id', 'order_id', 'branch_id'] });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang/wilayah Anda' });

  const item = await OrderItem.findOne({
    where: { id: orderItemId, order_id: invoice.order_id, type: ORDER_ITEM_TYPE.BUS },
    include: [
      { model: Order, as: 'Order', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name'] },
      { model: BusProgress, as: 'BusProgress', required: false }
    ]
  });
  if (!item) return res.status(404).json({ success: false, message: 'Item bus tidak ditemukan' });

  const buf = await buildBusSlipPdfBuffer(item);
  const orderNumber = item.Order?.order_number || 'ORD';
  const filename = `Slip_Bus_${(orderNumber || '').replace(/[^a-zA-Z0-9-]/g, '_')}_${String(orderItemId).slice(-6)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buf);
});

module.exports = {
  getDashboard,
  listInvoices,
  getInvoice,
  listOrders,
  getOrder,
  listProducts,
  updateItemProgress,
  exportExcel,
  exportPdf,
  getOrderItemSlip
};
