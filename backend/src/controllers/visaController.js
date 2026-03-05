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
  VisaProgress,
  Notification,
  PaymentReallocation
} = require('../models');
const { ORDER_ITEM_TYPE, VISA_PROGRESS_STATUS, NOTIFICATION_TRIGGER, ROLES, INVOICE_STATUS } = require('../constants');
const uploadConfig = require('../config/uploads');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');

async function getVisaBranchIds(user) {
  if (user.role === ROLES.SUPER_ADMIN) {
    const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
    return branches.map(b => b.id);
  }
  const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
  if (KOORDINATOR_ROLES.includes(user.role) && user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  if (user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  if (user.branch_id) return [user.branch_id];
  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
  return branches.map(b => b.id);
}

const visaDir = uploadConfig.getDir(uploadConfig.SUBDIRS.VISA_DOCS);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, visaDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    cb(null, `VISA_${req.params.orderItemId}_${date}_${time}${ext}`);
  }
});
const uploadVisaFile = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * GET /api/v1/visa/dashboard
 * Rekapitulasi pekerjaan visa berdasarkan invoice: total invoice, total item visa, per status.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const branchIds = await getVisaBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Role visa harus terikat cabang atau wilayah' });

  const orderIdsFromVisa = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.VISA },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromVisa.length === 0) {
    return res.json({
      success: true,
      data: { total_invoices: 0, total_visa_items: 0, by_status: {}, pending_list: [] }
    });
  }

  const invoices = await Invoice.findAll({
    where: { order_id: orderIdsFromVisa, branch_id: { [Op.in]: branchIds } },
    attributes: ['id', 'invoice_number', 'order_id'],
    raw: true
  });
  const orderIds = [...new Set(invoices.map(i => i.order_id))];
  const orders = await Order.findAll({
    where: { id: orderIds },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.VISA },
        required: true,
        include: [{ model: VisaProgress, as: 'VisaProgress', required: false }]
      }
    ]
  });

  let totalVisaItems = 0;
  const byStatus = {};
  Object.values(VISA_PROGRESS_STATUS).forEach(s => { byStatus[s] = 0; });
  const pendingList = [];

  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      totalVisaItems += 1;
      const prog = item.VisaProgress;
      const status = prog?.status || VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED;
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status !== VISA_PROGRESS_STATUS.ISSUED) {
        const inv = invoices.find(i => i.order_id === o.id);
        pendingList.push({
          invoice_id: inv?.id,
          invoice_number: inv?.invoice_number,
          order_id: o.id,
          order_item_id: item.id,
          owner_name: o.User?.name,
          product_ref_id: item.product_ref_id,
          quantity: item.quantity,
          meta: item.meta,
          manifest_file_url: item.manifest_file_url,
          status,
          visa_file_url: prog?.visa_file_url,
          issued_at: prog?.issued_at
        });
      }
    });
  });

  res.json({
    success: true,
    data: {
      total_invoices: invoices.length,
      total_visa_items: totalVisaItems,
      by_status: byStatus,
      pending_list: pendingList.slice(0, 50)
    }
  });
});

/**
 * GET /api/v1/visa/invoices
 * List invoices yang punya item visa (scope cabang/wilayah role visa).
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const branchIds = await getVisaBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Role visa harus terikat cabang atau wilayah' });

  const orderIdsFromVisa = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.VISA },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromVisa.length === 0) {
    return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } });
  }

  const { DP_PAYMENT_STATUS } = require('../constants');
  const ordersWithDpPaid = await Order.findAll({
    where: { id: orderIdsFromVisa, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
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
  // Progress: jangan tampilkan invoice yang sudah dibatalkan atau sudah direfund
  const refundedInvoiceIds = await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }).then(rows => rows.map(r => r.invoice_id).filter(Boolean));
  if (refundedInvoiceIds.length > 0) where.id = { [Op.notIn]: refundedInvoiceIds };
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({ status: { [Op.notIn]: ['canceled', 'cancelled', 'cancelled_refund'] } });

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
        attributes: ['id', 'order_number', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at'],
        include: [
          { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.VISA },
            required: true,
            include: [
              { model: VisaProgress, as: 'VisaProgress', required: false },
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
 * GET /api/v1/visa/invoices/:id
 * Detail invoice dengan item visa, progress, manifest.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchIds = await getVisaBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Role visa harus terikat cabang atau wilayah' });

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
              { model: VisaProgress, as: 'VisaProgress', required: false },
              { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }
            ]
          }
        ]
      }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang/wilayah Anda' });
  const visaItems = (invoice.Order?.OrderItems || []).filter(i => i.type === ORDER_ITEM_TYPE.VISA);
  if (visaItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item visa' });

  const data = invoice.get ? invoice.get({ plain: true }) : invoice;
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.VISA && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
    }
  });
  res.json({ success: true, data: data || invoice });
});

/**
 * PATCH /api/v1/visa/order-items/:orderItemId/progress
 * Update status pekerjaan visa (notes, status). issued_at set when status = issued.
 */
const updateItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { status, notes } = req.body;

  const item = await OrderItem.findByPk(orderItemId, {
    include: [{ model: Order, as: 'Order' }, { model: VisaProgress, as: 'VisaProgress', required: false }]
  });
  if (!item || item.type !== ORDER_ITEM_TYPE.VISA) return res.status(404).json({ success: false, message: 'Order item visa tidak ditemukan' });
  const branchIds = await getVisaBranchIds(req.user);
  if (branchIds.length === 0 || !branchIds.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

  const validStatuses = Object.values(VISA_PROGRESS_STATUS);
  if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });

  let progress = item.VisaProgress;
  if (!progress) {
    progress = await VisaProgress.create({
      order_item_id: item.id,
      status: status || VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED,
      notes: notes || null,
      updated_by: req.user.id,
      issued_at: status === VISA_PROGRESS_STATUS.ISSUED ? new Date() : null
    });
  } else {
    const updates = { updated_by: req.user.id };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (status === VISA_PROGRESS_STATUS.ISSUED) updates.issued_at = new Date();
    await progress.update(updates);
  }

  const updated = await VisaProgress.findByPk(progress.id);
  res.json({ success: true, data: updated });
});

/**
 * POST /api/v1/visa/order-items/:orderItemId/upload-visa
 * Upload dokumen visa. Jika set_status_issued maka status = issued dan kirim notifikasi.
 */
const uploadVisa = [
  uploadVisaFile.single('visa_file'),
  asyncHandler(async (req, res) => {
    const { orderItemId } = req.params;
    const { set_status_issued } = req.body;

    const item = await OrderItem.findByPk(orderItemId, {
      include: [{ model: Order, as: 'Order' }, { model: VisaProgress, as: 'VisaProgress', required: false }]
    });
    if (!item || item.type !== ORDER_ITEM_TYPE.VISA) return res.status(404).json({ success: false, message: 'Order item visa tidak ditemukan' });
    const branchIds = await getVisaBranchIds(req.user);
    if (branchIds.length === 0 || !branchIds.includes(item.Order.branch_id)) return res.status(403).json({ success: false, message: 'Bukan order cabang/wilayah Anda' });

    if (!req.file) return res.status(400).json({ success: false, message: 'File visa wajib diupload' });
    const orderNumber = item.Order?.order_number || 'ORD';
    const finalName = uploadConfig.visaDocFilename(orderNumber, item.id, req.file.originalname);
    const oldPath = req.file.path;
    const newPath = path.join(visaDir, finalName);
    let savedName = req.file.filename;
    try {
      fs.renameSync(oldPath, newPath);
      savedName = finalName;
    } catch (e) { /* keep temp name if rename fails */ }
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.VISA_DOCS, savedName);

    let progress = item.VisaProgress;
    if (!progress) {
      progress = await VisaProgress.create({
        order_item_id: item.id,
        status: set_status_issued === true || set_status_issued === '1' ? VISA_PROGRESS_STATUS.ISSUED : VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED,
        visa_file_url: fileUrl,
        issued_at: set_status_issued === true || set_status_issued === '1' ? new Date() : null,
        updated_by: req.user.id
      });
    } else {
      await progress.update({
        visa_file_url: fileUrl,
        updated_by: req.user.id,
        ...(set_status_issued === true || set_status_issued === '1'
          ? { status: VISA_PROGRESS_STATUS.ISSUED, issued_at: new Date() }
          : {})
      });
    }

    const order = await Order.findByPk(item.order_id, { include: [{ model: User, as: 'User', attributes: ['id', 'name'] }] });
    await progress.reload();
    const shouldNotify = progress.status === VISA_PROGRESS_STATUS.ISSUED;

    if (shouldNotify && order) {
      const title = 'Visa terbit';
      const message = `Visa untuk order ${order.order_number} telah terbit dan dokumen visa dapat diunduh.`;
      const data = { order_id: order.id, order_item_id: item.id, visa_file_url: fileUrl };

      await Notification.create({
        user_id: order.owner_id,
        trigger: NOTIFICATION_TRIGGER.VISA_ISSUED,
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
            trigger: NOTIFICATION_TRIGGER.VISA_ISSUED,
            title,
            message,
            data
          });
        }
      }
    }

    const updated = await VisaProgress.findByPk(progress.id);
    res.json({ success: true, data: updated });
  })
];

/**
 * GET /api/v1/visa/export-excel
 * Export rekap pekerjaan visa ke Excel.
 */
const exportExcel = asyncHandler(async (req, res) => {
  const branchIds = await getVisaBranchIds(req.user);
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Role visa harus terikat cabang atau wilayah' });

  const orderIdsFromVisa = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.VISA },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  if (orderIdsFromVisa.length === 0) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rekap-visa-${Date.now()}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Visa');
    await workbook.xlsx.write(res);
    return res.end();
  }

  const invoicesForExport = await Invoice.findAll({
    where: { order_id: orderIdsFromVisa, branch_id: { [Op.in]: branchIds } },
    attributes: ['order_id', 'invoice_number'],
    raw: true
  });
  const orderIdsWithInvoice = [...new Set(invoicesForExport.map(i => i.order_id))];

  const orders = await Order.findAll({
    where: { id: orderIdsWithInvoice, branch_id: { [Op.in]: branchIds } },
    include: [
      { model: User, as: 'User', attributes: ['id', 'name'] },
      {
        model: OrderItem,
        as: 'OrderItems',
        where: { type: ORDER_ITEM_TYPE.VISA },
        required: true,
        include: [{ model: VisaProgress, as: 'VisaProgress', required: false }]
      }
    ],
    order: [['order_number', 'ASC']]
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bintang Global - Role Visa';
  const sheet = workbook.addWorksheet('Rekap Visa', { headerFooter: { firstHeader: 'Rekap Pekerjaan Visa' } });

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Invoice Number', key: 'invoice_number', width: 22 },
    { header: 'Order Number', key: 'order_number', width: 20 },
    { header: 'Owner', key: 'owner_name', width: 25 },
    { header: 'Product Ref', key: 'product_ref_id', width: 38 },
    { header: 'Qty', key: 'quantity', width: 6 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Manifest', key: 'has_manifest', width: 10 },
    { header: 'Visa Upload', key: 'has_visa', width: 12 },
    { header: 'Issued At', key: 'issued_at', width: 20 },
    { header: 'Catatan', key: 'notes', width: 30 }
  ];
  sheet.getRow(1).font = { bold: true };

  let no = 1;
  orders.forEach(o => {
    const invRow = invoicesForExport.find(i => i.order_id === o.id);
    (o.OrderItems || []).forEach(item => {
      const prog = item.VisaProgress;
      const status = prog?.status || VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED;
      sheet.addRow({
        no: no++,
        invoice_number: invRow?.invoice_number || '',
        order_number: o.order_number,
        owner_name: o.User?.name || '',
        product_ref_id: item.product_ref_id || '',
        quantity: item.quantity,
        status,
        has_manifest: item.manifest_file_url ? 'Ya' : 'Tidak',
        has_visa: prog?.visa_file_url ? 'Ya' : 'Tidak',
        issued_at: prog?.issued_at ? new Date(prog.issued_at).toLocaleString('id-ID') : '',
        notes: prog?.notes || ''
      });
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=rekap-visa-${Date.now()}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getDashboard,
  listInvoices,
  getInvoice,
  updateItemProgress,
  uploadVisa,
  exportExcel
};
