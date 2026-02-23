const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  User,
  Branch,
  Product,
  Invoice,
  TicketProgress,
  Notification
} = require('../models');
const { ORDER_ITEM_TYPE, TICKET_PROGRESS_STATUS, NOTIFICATION_TRIGGER, ROLES } = require('../constants');
const uploadConfig = require('../config/uploads');

const ticketDir = uploadConfig.getDir(uploadConfig.SUBDIRS.TICKET_DOCS);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ticketDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    cb(null, `TIKET_${req.params.orderItemId}_${date}_${time}${ext}`);
  }
});
const uploadTicketFile = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * GET /api/v1/ticket/dashboard
 * Rekapitulasi pekerjaan tiket: total, per status, list pending.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role tiket harus terikat cabang' });

  const orderIdsFromTicket = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.TICKET },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromTicket.length === 0) {
    return res.json({
      success: true,
      data: { total_invoices: 0, total_ticket_items: 0, by_status: {}, pending_list: [] }
    });
  }

  const invoices = await Invoice.findAll({
    where: { order_id: orderIdsFromTicket, branch_id: branchId },
    attributes: ['id', 'invoice_number', 'order_id'],
    raw: true
  });
  const orderIdsWithInvoice = [...new Set(invoices.map(i => i.order_id))];

  const orders = await Order.findAll({
    where: { id: orderIdsWithInvoice },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.TICKET },
        required: true,
        include: [{ model: TicketProgress, as: 'TicketProgress', required: false }]
      }
    ]
  });

  let totalTicketItems = 0;
  const byStatus = {};
  Object.values(TICKET_PROGRESS_STATUS).forEach(s => { byStatus[s] = 0; });
  const pendingList = [];

  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      totalTicketItems += 1;
      const prog = item.TicketProgress;
      const status = prog?.status || TICKET_PROGRESS_STATUS.PENDING;
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status !== TICKET_PROGRESS_STATUS.TICKET_ISSUED) {
        const inv = invoices.find(i => i.order_id === o.id);
        pendingList.push({
          invoice_id: inv?.id,
          invoice_number: inv?.invoice_number,
          order_id: o.id,
          order_number: o.order_number,
          order_item_id: item.id,
          owner_name: o.User?.name,
          product_ref_id: item.product_ref_id,
          quantity: item.quantity,
          meta: item.meta,
          manifest_file_url: item.manifest_file_url,
          status,
          ticket_file_url: prog?.ticket_file_url,
          issued_at: prog?.issued_at
        });
      }
    });
  });

  res.json({
    success: true,
    data: {
      total_invoices: invoices.length,
      total_ticket_items: totalTicketItems,
      by_status: byStatus,
      pending_list: pendingList.slice(0, 50)
    }
  });
});

/**
 * GET /api/v1/ticket/invoices
 * List invoices yang punya item tiket (scope cabang role tiket).
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role tiket harus terikat cabang' });

  const orderIdsFromTicket = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.TICKET },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromTicket.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const where = { order_id: orderIdsFromTicket, branch_id: branchId };
  if (status) where.status = status;

  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'order_number', 'status', 'total_amount', 'currency'],
        include: [
          { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.TICKET },
            required: true,
            include: [{ model: TicketProgress, as: 'TicketProgress', required: false }]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']]
  });

  res.json({ success: true, data: invoices });
});

/**
 * GET /api/v1/ticket/invoices/:id
 * Detail invoice dengan item tiket, progress, manifest.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role tiket harus terikat cabang' });

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
            include: [{ model: TicketProgress, as: 'TicketProgress', required: false }]
          }
        ]
      }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (invoice.branch_id !== branchId) return res.status(403).json({ success: false, message: 'Bukan invoice cabang Anda' });
  const ticketItems = (invoice.Order?.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.TICKET);
  if (ticketItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item tiket' });

  res.json({ success: true, data: invoice });
});

/**
 * PATCH /api/v1/ticket/order-items/:orderItemId/progress
 * Update status pekerjaan tiket (notes, status). issued_at set when status = ticket_issued.
 */
const updateItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { status, notes } = req.body;

  const item = await OrderItem.findByPk(orderItemId, {
    include: [{ model: Order, as: 'Order' }, { model: TicketProgress, as: 'TicketProgress', required: false }]
  });
  if (!item || item.type !== ORDER_ITEM_TYPE.TICKET) return res.status(404).json({ success: false, message: 'Order item tiket tidak ditemukan' });
  if (item.Order.branch_id !== req.user.branch_id) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });

  const validStatuses = Object.values(TICKET_PROGRESS_STATUS);
  if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });

  let progress = item.TicketProgress;
  if (!progress) {
    progress = await TicketProgress.create({
      order_item_id: item.id,
      status: status || TICKET_PROGRESS_STATUS.PENDING,
      notes: notes || null,
      updated_by: req.user.id,
      issued_at: status === TICKET_PROGRESS_STATUS.TICKET_ISSUED ? new Date() : null
    });
  } else {
    const updates = { updated_by: req.user.id };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (status === TICKET_PROGRESS_STATUS.TICKET_ISSUED) updates.issued_at = new Date();
    await progress.update(updates);
  }

  const updated = await TicketProgress.findByPk(progress.id);
  res.json({ success: true, data: updated });
});

/**
 * POST /api/v1/ticket/order-items/:orderItemId/upload-ticket
 * Upload dokumen tiket. Jika status belum ticket_issued, bisa di-set ke ticket_issued dan kirim notifikasi.
 */
const uploadTicket = [
  uploadTicketFile.single('ticket_file'),
  asyncHandler(async (req, res) => {
    const { orderItemId } = req.params;
    const { set_status_issued } = req.body; // optional: '1' or true to set status to ticket_issued and notify

    const item = await OrderItem.findByPk(orderItemId, {
      include: [{ model: Order, as: 'Order' }, { model: TicketProgress, as: 'TicketProgress', required: false }]
    });
    if (!item || item.type !== ORDER_ITEM_TYPE.TICKET) return res.status(404).json({ success: false, message: 'Order item tiket tidak ditemukan' });
    if (item.Order.branch_id !== req.user.branch_id) return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });

    if (!req.file) return res.status(400).json({ success: false, message: 'File tiket wajib diupload' });
    const orderNumber = item.Order?.order_number || 'ORD';
    const finalName = uploadConfig.ticketDocFilename(orderNumber, item.id, req.file.originalname);
    const oldPath = req.file.path;
    const newPath = path.join(ticketDir, finalName);
    let savedName = req.file.filename;
    try {
      fs.renameSync(oldPath, newPath);
      savedName = finalName;
    } catch (e) { /* keep temp name if rename fails */ }
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.TICKET_DOCS, savedName);

    let progress = item.TicketProgress;
    if (!progress) {
      progress = await TicketProgress.create({
        order_item_id: item.id,
        status: set_status_issued === true || set_status_issued === '1' ? TICKET_PROGRESS_STATUS.TICKET_ISSUED : TICKET_PROGRESS_STATUS.PENDING,
        ticket_file_url: fileUrl,
        issued_at: set_status_issued === true || set_status_issued === '1' ? new Date() : null,
        updated_by: req.user.id
      });
    } else {
      await progress.update({
        ticket_file_url: fileUrl,
        updated_by: req.user.id,
        ...(set_status_issued === true || set_status_issued === '1'
          ? { status: TICKET_PROGRESS_STATUS.TICKET_ISSUED, issued_at: new Date() }
          : {})
      });
    }

    const order = await Order.findByPk(item.order_id, { include: [{ model: User, as: 'User', attributes: ['id', 'name'] }] });
    await progress.reload();
    const shouldNotify = progress.status === TICKET_PROGRESS_STATUS.TICKET_ISSUED;

    if (shouldNotify && order) {
      const title = 'Tiket terbit';
      const message = `Tiket untuk order ${order.order_number} telah terbit dan dokumen tiket dapat diunduh.`;
      const data = { order_id: order.id, order_item_id: item.id, ticket_file_url: fileUrl };

      await Notification.create({
        user_id: order.owner_id,
        trigger: NOTIFICATION_TRIGGER.TICKET_ISSUED,
        title,
        message,
        data
      });

      const invoiceUsers = await User.findAll({
        where: {
          role: { [Op.in]: [ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI] },
          is_active: true,
          [Op.or]: [{ branch_id: order.branch_id }, { branch_id: null }]
        },
        attributes: ['id']
      });
      for (const u of invoiceUsers) {
        if (u.id !== order.owner_id) {
          await Notification.create({
            user_id: u.id,
            trigger: NOTIFICATION_TRIGGER.TICKET_ISSUED,
            title,
            message,
            data
          });
        }
      }
    }

    const updated = await TicketProgress.findByPk(progress.id);
    res.json({ success: true, data: updated });
  })
];

/**
 * GET /api/v1/ticket/export-excel
 * Export rekap pekerjaan tiket ke Excel (dashboard data).
 */
const exportExcel = asyncHandler(async (req, res) => {
  const branchId = req.user.branch_id;
  if (!branchId) return res.status(403).json({ success: false, message: 'Role tiket harus terikat cabang' });

  const orderIdsFromTicket = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.TICKET },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromTicket.length === 0) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rekap-tiket-${Date.now()}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Tiket');
    await workbook.xlsx.write(res);
    return res.end();
  }

  const invoicesForExport = await Invoice.findAll({
    where: { order_id: orderIdsFromTicket, branch_id: branchId },
    attributes: ['order_id', 'invoice_number'],
    raw: true
  });
  const orderIdsWithInvoice = [...new Set(invoicesForExport.map(i => i.order_id))];

  const orders = await Order.findAll({
    where: { id: orderIdsWithInvoice },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.TICKET },
        required: true,
        include: [{ model: TicketProgress, as: 'TicketProgress', required: false }]
      }
    ],
    order: [['order_number', 'ASC']]
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bintang Global - Role Tiket';
  const sheet = workbook.addWorksheet('Rekap Tiket', { headerFooter: { firstHeader: 'Rekap Pekerjaan Tiket' } });

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Invoice Number', key: 'invoice_number', width: 22 },
    { header: 'Order Number', key: 'order_number', width: 20 },
    { header: 'Owner', key: 'owner_name', width: 25 },
    { header: 'Product Ref', key: 'product_ref_id', width: 38 },
    { header: 'Qty', key: 'quantity', width: 6 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Manifest', key: 'has_manifest', width: 10 },
    { header: 'Tiket Upload', key: 'has_ticket', width: 12 },
    { header: 'Issued At', key: 'issued_at', width: 20 },
    { header: 'Catatan', key: 'notes', width: 30 }
  ];
  sheet.getRow(1).font = { bold: true };

  let no = 1;
  orders.forEach(o => {
    const invRow = invoicesForExport.find(i => i.order_id === o.id);
    (o.OrderItems || []).forEach(item => {
      const prog = item.TicketProgress;
      const status = prog?.status || TICKET_PROGRESS_STATUS.PENDING;
      sheet.addRow({
        no: no++,
        invoice_number: invRow?.invoice_number || '',
        order_number: o.order_number,
        owner_name: o.User?.name || '',
        product_ref_id: item.product_ref_id || '',
        quantity: item.quantity,
        status,
        has_manifest: item.manifest_file_url ? 'Ya' : 'Tidak',
        has_ticket: prog?.ticket_file_url ? 'Ya' : 'Tidak',
        issued_at: prog?.issued_at ? new Date(prog.issued_at).toLocaleString('id-ID') : '',
        notes: prog?.notes || ''
      });
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=rekap-tiket-${Date.now()}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getDashboard,
  listInvoices,
  getInvoice,
  updateItemProgress,
  uploadTicket,
  exportExcel
};
