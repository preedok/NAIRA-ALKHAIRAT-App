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
  Provinsi,
  Wilayah,
  Product,
  Invoice,
  Refund,
  TicketProgress,
  Notification,
  PaymentReallocation
} = require('../models');
const { ORDER_ITEM_TYPE, TICKET_PROGRESS_STATUS, NOTIFICATION_TRIGGER, ROLES, INVOICE_STATUS, DP_PAYMENT_STATUS } = require('../constants');
const uploadConfig = require('../config/uploads');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');

const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
/** Scope cabang: super_admin = semua cabang, koordinator = wilayah, tiket_koordinator = cabang/wilayah. Jika belum terikat, fallback semua cabang agar tidak 403. */
async function getTicketBranchIds(user) {
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
  // Fallback: tiket_koordinator tanpa cabang/wilayah tetap bisa akses (semua cabang) agar data tampil
  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
  return branches.map(b => b.id);
}

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
 * Data menu tiket diambil hanya dari data INVOICE yang order-nya memiliki item tiket.
 * Semua endpoint (dashboard, listInvoices, getInvoice, exportExcel) memakai invoice sebagai sumber.
 */

/**
 * GET /api/v1/ticket/dashboard
 * Rekapitulasi pekerjaan tiket: total, per status, list pending. Hanya invoice yang order-nya punya item tiket.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchIds = await getTicketBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

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
    where: { order_id: orderIdsFromTicket, branch_id: { [Op.in]: branchIds } },
    attributes: ['id', 'invoice_number', 'order_id'],
    include: [{ model: User, as: 'User', attributes: ['id', 'name'] }]
  });
  const orderIdsWithInvoice = [...new Set(invoices.map(i => i.order_id))];
  const ownerNameByOrderId = invoices.reduce((acc, inv) => {
    if (inv.order_id && inv.User?.name) acc[inv.order_id] = inv.User.name;
    return acc;
  }, {});

  const orders = await Order.findAll({
    where: { id: orderIdsWithInvoice },
    include: [
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
          order_item_id: item.id,
          owner_name: ownerNameByOrderId[o.id] ?? inv?.User?.name ?? null,
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
 * List invoice saja yang order-nya punya item tiket (scope cabang role tiket).
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const branchIds = await getTicketBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIdsFromTicket = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.TICKET },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromTicket.length === 0) {
    return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } });
  }

  // Order yang sudah pembayaran DP: invoice status tentative pun tampil di Daftar Invoice Tiket
  const ordersWithDpPaid = await Order.findAll({
    where: { id: orderIdsFromTicket, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
    attributes: ['id'],
    raw: true
  }).then(rows => rows.map(r => r.id));

  const statusesForProgress = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  const where = { order_id: { [Op.in]: orderIdsFromTicket }, branch_id: { [Op.in]: branchIds } };
  if (status && statusesForProgress.includes(status)) {
    where.status = status;
  } else {
    where[Op.or] = [
      { status: { [Op.in]: statusesForProgress } },
      ...(ordersWithDpPaid.length > 0 ? [{ status: INVOICE_STATUS.TENTATIVE, order_id: { [Op.in]: ordersWithDpPaid } }] : [])
    ];
  }
  // Progress: jangan tampilkan invoice yang sudah dibatalkan atau sudah direfund
  const refundedInvoiceIds = await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }).then(rows => rows.map(r => r.invoice_id).filter(Boolean));
  if (refundedInvoiceIds.length > 0) where.id = { [Op.notIn]: refundedInvoiceIds };
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({ status: { [Op.notIn]: [INVOICE_STATUS.CANCELED, INVOICE_STATUS.CANCELLED_REFUND] } });

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  // Data acuan dari invoice: tidak include Order.User (owner) agar tidak pakai Order.owner_id; owner dari Invoice.User.
  const { count, rows: invoices } = await Invoice.findAndCountAll({
    where,
    include: [
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'order_number', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at'],
        include: [
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.TICKET },
            required: true,
            include: [
              { model: TicketProgress, as: 'TicketProgress', required: false },
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
 * GET /api/v1/ticket/invoices/:id
 * Detail invoice (hanya yang order-nya punya item tiket); return 404 jika tidak ada item tiket.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchIds = await getTicketBranchIds(req.user);
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
          { model: Branch, as: 'Branch' },
          {
            model: OrderItem,
            as: 'OrderItems',
            include: [
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false },
              { model: TicketProgress, as: 'TicketProgress', required: false }
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
    return res.status(403).json({ success: false, message: 'Invoice tidak tersedia untuk divisi tiket.' });
  }
  const ticketItems = (invoice.Order?.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.TICKET);
  if (ticketItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item tiket' });

  const data = invoice.get ? invoice.get({ plain: true }) : invoice;
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.TICKET && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
    }
  });

  res.json({ success: true, data });
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
  const branchIdsProgress = await getTicketBranchIds(req.user);
  if (branchIdsProgress.length === 0 || !branchIdsProgress.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

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
    const branchIdsUpload = await getTicketBranchIds(req.user);
    if (branchIdsUpload.length === 0 || !branchIdsUpload.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

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

    const order = await Order.findByPk(item.order_id, { attributes: ['id', 'order_number', 'branch_id'] });
    await progress.reload();
    const shouldNotify = progress.status === TICKET_PROGRESS_STATUS.TICKET_ISSUED;

    const invoiceForOwner = order ? await Invoice.findOne({ where: { order_id: order.id }, attributes: ['owner_id'] }) : null;
    const ownerId = invoiceForOwner ? invoiceForOwner.owner_id : null;

    if (shouldNotify && order) {
      const title = 'Tiket terbit';
      const message = `Tiket untuk order ${order.order_number} telah terbit dan dokumen tiket dapat diunduh.`;
      const data = { order_id: order.id, order_item_id: item.id, ticket_file_url: fileUrl };

      if (ownerId) {
        await Notification.create({
          user_id: ownerId,
          trigger: NOTIFICATION_TRIGGER.TICKET_ISSUED,
          title,
          message,
          data
        });
      }

      const invoiceUsers = await User.findAll({
        where: {
          role: { [Op.in]: [ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI] },
          is_active: true,
          [Op.or]: [{ branch_id: order.branch_id }, { branch_id: null }]
        },
        attributes: ['id']
      });
      for (const u of invoiceUsers) {
        if (u.id !== ownerId) {
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
 * Export rekap pekerjaan tiket ke Excel; data dari invoice yang order-nya punya item tiket.
 */
const exportExcel = asyncHandler(async (req, res) => {
  const branchIds = await getTicketBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

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
    where: { order_id: orderIdsFromTicket, branch_id: { [Op.in]: branchIds } },
    attributes: ['order_id', 'invoice_number'],
    include: [{ model: User, as: 'User', attributes: ['name'] }]
  });
  const orderIdsWithInvoice = [...new Set(invoicesForExport.map(i => i.order_id))];
  const ownerNameByOrderIdExport = invoicesForExport.reduce((acc, inv) => {
    if (inv.order_id && inv.User?.name) acc[inv.order_id] = inv.User.name;
    return acc;
  }, {});

  const orders = await Order.findAll({
    where: { id: orderIdsWithInvoice },
    include: [
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
        owner_name: ownerNameByOrderIdExport[o.id] || '',
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
