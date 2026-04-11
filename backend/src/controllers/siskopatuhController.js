const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const uploadConfig = require('../config/uploads');
const {
  Order,
  OrderItem,
  User,
  Invoice,
  Product,
  Refund,
  Branch,
  Provinsi,
  Wilayah,
  PaymentReallocation,
  PaymentProof,
  Bank,
  AccountingBankAccount,
  OwnerProfile,
  VisaProgress,
  TicketProgress,
  HotelProgress,
  BusProgress
} = require('../models');
const {
  ORDER_ITEM_TYPE,
  INVOICE_STATUS,
  SISKOPATUH_PROGRESS_STATUS,
  DP_PAYMENT_STATUS
} = require('../constants');
const { balanceAllocationsByInvoiceId } = require('../utils/balanceAllocationsBatch');
const {
  PROGRESS_INVOICE_STATUS_BLOCKLIST,
  REFUND_STATUSES_HIDE_FROM_PROGRESS,
  appendProgressExcludeCancelledOrders
} = require('../utils/progressInvoiceFilters');

const siskopatuhDocsDir = uploadConfig.getDir(uploadConfig.SUBDIRS.SISKOPATUH_DOCS);
const siskopatuhUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, siskopatuhDocsDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    cb(null, `SISKOPATUH_${req.params.orderItemId}_${date}_${time}${ext}`);
  }
});
const uploadSiskopatuhFileMulter = multer({ storage: siskopatuhUploadStorage, limits: { fileSize: 25 * 1024 * 1024 } });

const PAYMENT_PROOF_ATTRS = [
  'id', 'invoice_id', 'payment_type', 'amount', 'payment_currency', 'amount_original', 'amount_idr', 'amount_sar', 'bank_id', 'bank_name', 'account_number', 'sender_account_name', 'sender_account_number', 'recipient_bank_account_id', 'transfer_date', 'proof_file_url', 'uploaded_by', 'verified_by', 'verified_at', 'verified_status', 'notes', 'issued_by', 'payment_location', 'reconciled_at', 'reconciled_by', 'created_at', 'updated_at'
];

const statusWithDpPaidList = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];

/** Sama pola bus/tiket: semua cabang aktif (role hanya super_admin & role_siskopatuh di route). */
async function getSiskopatuhBranchIds() {
  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
  return branches.map((b) => b.id);
}

/**
 * GET /api/v1/siskopatuh/dashboard
 */
const getDashboard = asyncHandler(async (req, res) => {
  const { date_from, date_to } = req.query;
  const refundedInvoiceIds = new Set(
    (await Refund.findAll({ where: { status: 'refunded' }, attributes: ['invoice_id'], raw: true }))
      .map((r) => r.invoice_id)
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
    where: { type: ORDER_ITEM_TYPE.SISKOPATUH },
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

  let totalSiskopatuhItems = 0;
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
    totalSiskopatuhItems += 1;
    const status = (item.meta && item.meta.siskopatuh_status) || SISKOPATUH_PROGRESS_STATUS.PENDING;
    const norm = status === SISKOPATUH_PROGRESS_STATUS.COMPLETED ? 'completed' : status === SISKOPATUH_PROGRESS_STATUS.IN_PROGRESS ? 'in_progress' : 'pending';
    byStatus[norm] = (byStatus[norm] || 0) + 1;
    if (norm !== 'completed') {
      pendingList.push({
        order_id: item.Order?.id,
        invoice_id: inv?.id,
        invoice_number: inv?.invoice_number,
        order_item_id: item.id,
        owner_name: item.Order?.User?.name,
        pic_name: inv?.pic_name || item.Order?.pic_name || null,
        product_name: item.Product?.name || 'Siskopatuh',
        quantity: item.quantity,
        status: norm
      });
    }
  });

  res.json({
    success: true,
    data: {
      total_orders: orderIdsWithDpPaid.size,
      total_siskopatuh_items: totalSiskopatuhItems,
      by_status: byStatus,
      pending_list: pendingList.slice(0, 50)
    }
  });
});

/**
 * GET /api/v1/siskopatuh/invoices
 * Daftar invoice yang order-nya punya item siskopatuh (sama pola tiket/bus untuk tabel Progress).
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const branchIds = await getSiskopatuhBranchIds();
  if (branchIds.length === 0) return res.status(403).json({ success: false, message: 'Tidak ada cabang aktif. Hubungi admin.' });

  const orderIdsFromSisk = await OrderItem.findAll({
    where: { type: ORDER_ITEM_TYPE.SISKOPATUH },
    attributes: ['order_id'],
    raw: true
  }).then((rows) => [...new Set(rows.map((r) => r.order_id))]);

  if (orderIdsFromSisk.length === 0) {
    return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 25, totalPages: 0 } });
  }

  const ordersWithDpPaid = await Order.findAll({
    where: { id: orderIdsFromSisk, dp_payment_status: DP_PAYMENT_STATUS.PEMBAYARAN_DP },
    attributes: ['id'],
    raw: true
  }).then((rows) => rows.map((r) => r.id));

  const statusesForProgress = [INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  const where = { order_id: { [Op.in]: orderIdsFromSisk }, branch_id: { [Op.in]: branchIds } };
  if (status && statusesForProgress.includes(status)) {
    where.status = status;
  } else {
    where[Op.or] = [
      { status: { [Op.in]: statusesForProgress } },
      ...(ordersWithDpPaid.length > 0 ? [{ status: INVOICE_STATUS.TENTATIVE, order_id: { [Op.in]: ordersWithDpPaid } }] : [])
    ];
  }
  const refundExcludedInvoiceIds = await Refund.findAll({
    where: { status: { [Op.in]: REFUND_STATUSES_HIDE_FROM_PROGRESS } },
    attributes: ['invoice_id'],
    raw: true
  }).then((rows) => [...new Set((rows || []).map((r) => r.invoice_id).filter(Boolean))]);
  if (refundExcludedInvoiceIds.length > 0) where.id = { [Op.notIn]: refundExcludedInvoiceIds };
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({ status: { [Op.notIn]: PROGRESS_INVOICE_STATUS_BLOCKLIST } });
  appendProgressExcludeCancelledOrders(where, Op);

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const { count, rows: invoices } = await Invoice.findAndCountAll({
    where,
    include: [
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'], include: [{ model: OwnerProfile, as: 'OwnerProfile', attributes: ['is_mou_owner'], required: false }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, order: [['created_at', 'ASC']], attributes: PAYMENT_PROOF_ATTRS, include: [{ model: User, as: 'VerifiedBy', attributes: ['id', 'name'], required: false }, { model: Bank, as: 'Bank', attributes: ['id', 'name'], required: false }, { model: AccountingBankAccount, as: 'RecipientAccount', attributes: ['id', 'name', 'bank_name', 'account_number', 'currency'], required: false }] },
      {
        model: Order,
        as: 'Order',
        attributes: ['id', 'owner_id', 'order_number', 'status', 'total_amount', 'currency', 'dp_payment_status', 'dp_percentage_paid', 'order_updated_at', 'currency_rates_override', 'penalty_amount', 'waive_bus_penalty', 'bus_service_option', 'bus_include_arrival_status', 'bus_include_arrival_bus_number', 'bus_include_arrival_date', 'bus_include_arrival_time', 'bus_include_return_status', 'bus_include_return_bus_number', 'bus_include_return_date', 'bus_include_return_time'],
        include: [
          {
            model: OrderItem,
            as: 'OrderItems',
            where: { type: ORDER_ITEM_TYPE.SISKOPATUH },
            required: true,
            attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta', 'jamaah_data_type', 'jamaah_data_value', 'manifest_file_url'],
            include: [{ model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset,
    distinct: true
  });

  const orderIdsFromInvoices = [...new Set((invoices || []).map((i) => i.order_id).filter(Boolean))];
  let orderItemsByOrderId = {};
  if (orderIdsFromInvoices.length > 0) {
    const allItemTypes = [
      ORDER_ITEM_TYPE.VISA,
      ORDER_ITEM_TYPE.TICKET,
      ORDER_ITEM_TYPE.HOTEL,
      ORDER_ITEM_TYPE.BUS,
      ORDER_ITEM_TYPE.HANDLING,
      ORDER_ITEM_TYPE.PACKAGE,
      ORDER_ITEM_TYPE.SISKOPATUH
    ];
    const fullItems = await OrderItem.findAll({
      where: { order_id: orderIdsFromInvoices, type: { [Op.in]: allItemTypes } },
      include: [
        { model: VisaProgress, as: 'VisaProgress', required: false },
        { model: TicketProgress, as: 'TicketProgress', required: false },
        { model: HotelProgress, as: 'HotelProgress', required: false },
        { model: BusProgress, as: 'BusProgress', required: false },
        { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type', 'meta'], required: false }
      ],
      attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta', 'jamaah_data_type', 'jamaah_data_value', 'manifest_file_url']
    });
    fullItems.forEach((it) => {
      const oid = it.order_id;
      if (!orderItemsByOrderId[oid]) orderItemsByOrderId[oid] = [];
      const plain = it.get ? it.get({ plain: true }) : it;
      plain.product_name = plain.Product && plain.Product.name ? plain.Product.name : null;
      plain.product_type = plain.type || (plain.Product && plain.Product.type) || null;
      orderItemsByOrderId[oid].push(plain);
    });
  }
  const invoiceIds = (invoices || []).map((i) => i.id).filter(Boolean);
  let balByInvId = {};
  if (invoiceIds.length > 0) {
    const [reallocOut, reallocIn, balMap] = await Promise.all([
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
      }),
      balanceAllocationsByInvoiceId(invoiceIds)
    ]);
    balByInvId = balMap;
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
      inv.setDataValue('BalanceAllocations', balByInvId[inv.id] || []);
    }
  }

  const totalPages = Math.ceil((count || 0) / lim) || 1;
  const data = (invoices || []).map((inv) => {
    const plain = inv.get ? inv.get({ plain: true }) : inv;
    if (plain.Order && orderItemsByOrderId[plain.order_id]) plain.Order.OrderItems = orderItemsByOrderId[plain.order_id];
    return plain;
  });
  res.json({ success: true, data, pagination: { total: count || 0, page: pg, limit: lim, totalPages } });
});

/**
 * GET /api/v1/siskopatuh/invoices/:id
 */
const getInvoice = asyncHandler(async (req, res) => {
  const branchIds = await getSiskopatuhBranchIds();
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
          { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
          { model: Branch, as: 'Branch' },
          {
            model: OrderItem,
            as: 'OrderItems',
            include: [{ model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false }],
            attributes: ['id', 'order_id', 'type', 'quantity', 'product_ref_id', 'meta', 'jamaah_data_type', 'jamaah_data_value', 'manifest_file_url']
          }
        ]
      }
    ]
  });
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  if (!branchIds.includes(invoice.branch_id)) return res.status(403).json({ success: false, message: 'Bukan invoice cabang Anda' });
  const allowedStatuses = [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.PAID, INVOICE_STATUS.PROCESSING, INVOICE_STATUS.COMPLETED];
  if (!invoice.status || !allowedStatuses.includes(invoice.status)) {
    return res.status(403).json({ success: false, message: 'Invoice tidak tersedia untuk divisi siskopatuh.' });
  }
  const siskItems = (invoice.Order?.OrderItems || []).filter((i) => i.type === ORDER_ITEM_TYPE.SISKOPATUH);
  if (siskItems.length === 0) return res.status(404).json({ success: false, message: 'Invoice ini tidak memiliki item siskopatuh' });

  const data = invoice.get ? invoice.get({ plain: true }) : invoice;
  (data?.Order?.OrderItems || []).forEach((oi) => {
    if (oi.type === ORDER_ITEM_TYPE.SISKOPATUH && (oi.Product || oi.product)) {
      const p = oi.Product || oi.product;
      oi.product_name = p.name || p.code || null;
    }
  });

  const balMap = await balanceAllocationsByInvoiceId([invoice.id]);
  data.BalanceAllocations = balMap[invoice.id] || [];

  res.json({ success: true, data });
});

/**
 * PATCH /api/v1/siskopatuh/order-items/:orderItemId/progress
 */
const updateOrderItemProgress = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { siskopatuh_status } = req.body;

  const allowed = [SISKOPATUH_PROGRESS_STATUS.PENDING, SISKOPATUH_PROGRESS_STATUS.IN_PROGRESS, SISKOPATUH_PROGRESS_STATUS.COMPLETED];
  if (!siskopatuh_status || !allowed.includes(siskopatuh_status)) {
    return res.status(400).json({ success: false, message: 'siskopatuh_status harus salah satu: pending, in_progress, completed' });
  }

  const item = await OrderItem.findOne({
    where: { id: orderItemId, type: ORDER_ITEM_TYPE.SISKOPATUH },
    include: [{ model: Order, as: 'Order', attributes: ['id', 'branch_id'] }]
  });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Order item siskopatuh tidak ditemukan.' });
  }
  const branchIds = await getSiskopatuhBranchIds();
  if (!branchIds.includes(item.Order.branch_id)) {
    return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });
  }

  const meta = item.meta && typeof item.meta === 'object' ? { ...item.meta } : {};
  meta.siskopatuh_status = siskopatuh_status;
  await item.update({ meta });

  res.json({
    success: true,
    data: { order_item_id: item.id, siskopatuh_status }
  });
});

/**
 * POST /api/v1/siskopatuh/order-items/:orderItemId/siskopatuh-document
 * Upload dokumen siskopatuh (PDF/ZIP/dll.) hanya jika status progress = selesai (completed).
 */
const uploadSiskopatuhDocument = [
  uploadSiskopatuhFileMulter.single('siskopatuh_file'),
  asyncHandler(async (req, res) => {
    const { orderItemId } = req.params;
    const item = await OrderItem.findByPk(orderItemId, {
      include: [{ model: Order, as: 'Order', attributes: ['id', 'branch_id'] }]
    });
    if (!item || item.type !== ORDER_ITEM_TYPE.SISKOPATUH) {
      return res.status(404).json({ success: false, message: 'Order item siskopatuh tidak ditemukan' });
    }
    const branchIds = await getSiskopatuhBranchIds();
    if (!branchIds.includes(item.Order.branch_id)) {
      return res.status(403).json({ success: false, message: 'Bukan order cabang Anda' });
    }
    const metaNow = item.meta && typeof item.meta === 'object' ? item.meta : {};
    const st = metaNow.siskopatuh_status || SISKOPATUH_PROGRESS_STATUS.PENDING;
    if (st !== SISKOPATUH_PROGRESS_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Upload dokumen siskopatuh hanya setelah status progres "Selesai" (completed).'
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File wajib diupload' });
    }
    const invoiceForFile = await Invoice.findOne({ where: { order_id: item.order_id }, attributes: ['invoice_number'] });
    const refLabel = (invoiceForFile && invoiceForFile.invoice_number) ? String(invoiceForFile.invoice_number).replace(/[^\w\-]/g, '_') : 'INV';
    const finalName = uploadConfig.siskopatuhDocFilename(refLabel, item.id, req.file.originalname);
    const newPath = path.join(siskopatuhDocsDir, finalName);
    let savedName = req.file.filename;
    try {
      fs.renameSync(req.file.path, newPath);
      savedName = finalName;
    } catch (e) {
      /* keep temp name */
    }
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.SISKOPATUH_DOCS, savedName);
    const meta = { ...metaNow, siskopatuh_file_url: fileUrl, siskopatuh_file_uploaded_at: new Date().toISOString() };
    await item.update({ meta });
    res.json({
      success: true,
      data: { order_item_id: item.id, siskopatuh_file_url: fileUrl }
    });
  })
];

module.exports = {
  getDashboard,
  updateOrderItemProgress,
  listInvoices,
  getInvoice,
  uploadSiskopatuhDocument
};
