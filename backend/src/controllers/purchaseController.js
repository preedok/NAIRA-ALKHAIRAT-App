'use strict';

const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Op } = require('sequelize');
const uploadConfig = require('../config/uploads');
const {
  AccountingSupplier,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchasePayment,
  Branch,
  User,
  Product,
  ChartOfAccount,
  AccountingPeriod,
  AccountingFiscalYear,
  JournalEntry,
  JournalEntryLine,
  AccountingBankAccount
} = require('../models');

const proofDir = uploadConfig.getDir(uploadConfig.SUBDIRS.PURCHASE_PROOFS);
const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
const storagePo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    const id = crypto.randomBytes(4).toString('hex');
    cb(null, `BUKTI_PO_${date}_${time}_${id}${ext}`);
  }
});
const storageInvoice = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    const id = crypto.randomBytes(4).toString('hex');
    cb(null, `BUKTI_PURCHASE_${date}_${time}_${id}${ext}`);
  }
});
const uploadPurchaseOrderProof = multer({ storage: storagePo, limits: { fileSize: 10 * 1024 * 1024 } }).single('proof_file');
const uploadPurchaseInvoiceProof = multer({ storage: storageInvoice, limits: { fileSize: 10 * 1024 * 1024 } }).single('proof_file');

// ---------- Helpers ----------
async function getPeriodByDate(dateStr) {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const dateOnly = d.toISOString().slice(0, 10);
  const period = await AccountingPeriod.findOne({
    where: {
      start_date: { [Op.lte]: dateOnly },
      end_date: { [Op.gte]: dateOnly },
      is_locked: false
    },
    include: [{ model: AccountingFiscalYear, as: 'FiscalYear', attributes: ['id', 'code'] }]
  });
  return period;
}

async function nextJournalNumber(prefix = 'JEP') {
  const yyyymm = new Date().toISOString().slice(0, 7).replace(/-/, '');
  const pattern = `${prefix}-${yyyymm}-%`;
  const last = await JournalEntry.findOne({
    where: { journal_number: { [Op.like]: pattern } },
    order: [['journal_number', 'DESC']],
    attributes: ['journal_number']
  });
  const num = last ? parseInt(last.journal_number.slice(-3), 10) + 1 : 1;
  return `${prefix}-${yyyymm}-${String(num).padStart(3, '0')}`;
}

// ---------- Suppliers ----------
const listSuppliers = asyncHandler(async (req, res) => {
  const { search, is_active, page = 1, limit = 20 } = req.query;
  const where = {};
  if (search) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${search}%` } },
      { name: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (is_active !== undefined) where.is_active = is_active === 'true';
  const { count, rows } = await AccountingSupplier.findAndCountAll({
    where,
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: (Math.max(1, parseInt(page, 10)) - 1) * (parseInt(limit, 10) || 20),
    order: [['code', 'ASC']],
    include: [{ model: ChartOfAccount, as: 'PayableAccount', attributes: ['id', 'code', 'name'], required: false }]
  });
  res.json({ success: true, data: rows, total: count });
});

const getSupplier = asyncHandler(async (req, res) => {
  const s = await AccountingSupplier.findByPk(req.params.id, {
    include: [{ model: ChartOfAccount, as: 'PayableAccount', attributes: ['id', 'code', 'name'], required: false }]
  });
  if (!s) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
  res.json({ success: true, data: s });
});

const createSupplier = asyncHandler(async (req, res) => {
  const { code, name, supplier_type, currency, term_of_payment_days, payable_account_id, is_active, meta } = req.body;
  const existing = await AccountingSupplier.findOne({ where: { code } });
  if (existing) return res.status(400).json({ success: false, message: 'Kode supplier sudah ada' });
  const s = await AccountingSupplier.create({
    code: code || name?.slice(0, 20),
    name,
    supplier_type: supplier_type || 'vendor',
    currency: currency || 'IDR',
    term_of_payment_days: term_of_payment_days ?? 0,
    payable_account_id: payable_account_id || null,
    is_active: is_active !== false,
    meta: meta || {}
  });
  res.status(201).json({ success: true, data: s });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const s = await AccountingSupplier.findByPk(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
  const { name, supplier_type, currency, term_of_payment_days, payable_account_id, is_active, meta } = req.body;
  await s.update({
    ...(name != null && { name }),
    ...(supplier_type != null && { supplier_type }),
    ...(currency != null && { currency }),
    ...(term_of_payment_days != null && { term_of_payment_days }),
    ...(payable_account_id !== undefined && { payable_account_id }),
    ...(is_active !== undefined && { is_active }),
    ...(meta != null && { meta })
  });
  res.json({ success: true, data: s });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const s = await AccountingSupplier.findByPk(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
  const used = await PurchaseOrder.count({ where: { supplier_id: s.id } });
  if (used > 0) return res.status(400).json({ success: false, message: 'Supplier masih dipakai di PO, tidak dapat dihapus' });
  await s.destroy();
  res.json({ success: true, message: 'Supplier dihapus' });
});

// ---------- Purchase Orders ----------
const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { supplier_id, product_id, status, branch_id, date_from, date_to, page = 1, limit = 20 } = req.query;
  const where = {};
  if (supplier_id) where.supplier_id = supplier_id;
  if (product_id) where.product_id = product_id;
  if (status) where.status = status;
  if (branch_id) where.branch_id = branch_id;
  if (date_from || date_to) {
    where.order_date = {};
    if (date_from) where.order_date[Op.gte] = date_from;
    if (date_to) where.order_date[Op.lte] = date_to;
  }
  const { count, rows } = await PurchaseOrder.findAndCountAll({
    where,
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: (Math.max(1, parseInt(page, 10)) - 1) * (parseInt(limit, 10) || 20),
    order: [['order_date', 'DESC'], ['created_at', 'DESC']],
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false }
    ]
  });
  res.json({ success: true, data: rows, total: count });
});

const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name', 'currency', 'payable_account_id'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false },
      { model: PurchaseOrderLine, as: 'Lines', include: [{ model: ChartOfAccount, as: 'Account', attributes: ['id', 'code', 'name'], required: false }], order: [['line_number', 'ASC']] }
    ]
  });
  if (!po) return res.status(404).json({ success: false, message: 'Purchase order tidak ditemukan' });
  res.json({ success: true, data: po });
});

const createPurchaseOrder = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Bukti pembelian (file) wajib diunggah' });
  const proofPath = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.PURCHASE_PROOFS, req.file.filename);

  const { supplier_id, product_id, branch_id, order_date, expected_date, currency, notes, lines: linesRaw } = req.body;
  let lines = [];
  if (linesRaw) {
    try {
      lines = typeof linesRaw === 'string' ? JSON.parse(linesRaw) : linesRaw;
    } catch (_) {}
  }
  const supplier = await AccountingSupplier.findByPk(supplier_id);
  if (!supplier) return res.status(400).json({ success: false, message: 'Supplier tidak ditemukan' });

  const lastPo = await PurchaseOrder.findOne({ order: [['created_at', 'DESC']], attributes: ['po_number'] });
  const nextNum = lastPo ? parseInt((lastPo.po_number || '').replace(/\D/g, ''), 10) + 1 : 1;
  const po_number = `PO-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  const po = await PurchaseOrder.create({
    po_number,
    supplier_id,
    product_id: product_id || null,
    branch_id: branch_id || null,
    order_date: order_date || new Date().toISOString().slice(0, 10),
    expected_date: expected_date || null,
    status: 'draft',
    currency: currency || 'IDR',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    notes: notes || null,
    proof_file_path: proofPath,
    created_by: req.user?.id
  });

  let subtotal = 0;
  if (Array.isArray(lines) && lines.length) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(l.quantity) || 1;
      const up = parseFloat(l.unit_price) || 0;
      const amt = qty * up;
      subtotal += amt;
      await PurchaseOrderLine.create({
        purchase_order_id: po.id,
        line_number: i + 1,
        description: l.description || null,
        quantity: qty,
        unit: l.unit || 'pcs',
        unit_price: up,
        amount: amt,
        account_id: l.account_id || null,
        tax_rate: parseFloat(l.tax_rate) || 0
      });
    }
  }
  const taxAmount = 0;
  await po.update({ subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount });

  const full = await PurchaseOrder.findByPk(po.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: PurchaseOrderLine, as: 'Lines', order: [['line_number', 'ASC']] }
    ]
  });
  res.status(201).json({ success: true, data: full });
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id, { include: [{ model: PurchaseOrderLine, as: 'Lines' }] });
  if (!po) return res.status(404).json({ success: false, message: 'Purchase order tidak ditemukan' });
  if (po.status !== 'draft') return res.status(400).json({ success: false, message: 'Hanya PO draft yang dapat diedit' });

  const { product_id, branch_id, order_date, expected_date, currency, notes, lines } = req.body;
  if (product_id !== undefined) po.product_id = product_id;
  if (branch_id !== undefined) po.branch_id = branch_id;
  if (order_date) po.order_date = order_date;
  if (expected_date !== undefined) po.expected_date = expected_date;
  if (currency) po.currency = currency;
  if (notes !== undefined) po.notes = notes;
  await po.save();

  if (Array.isArray(lines)) {
    await PurchaseOrderLine.destroy({ where: { purchase_order_id: po.id } });
    let subtotal = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(l.quantity) || 1;
      const up = parseFloat(l.unit_price) || 0;
      const amt = qty * up;
      subtotal += amt;
      await PurchaseOrderLine.create({
        purchase_order_id: po.id,
        line_number: i + 1,
        description: l.description || null,
        quantity: qty,
        unit: l.unit || 'pcs',
        unit_price: up,
        amount: amt,
        account_id: l.account_id || null,
        tax_rate: parseFloat(l.tax_rate) || 0
      });
    }
    await po.update({ subtotal, tax_amount: 0, total_amount: subtotal });
  }

  const full = await PurchaseOrder.findByPk(po.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: PurchaseOrderLine, as: 'Lines', order: [['line_number', 'ASC']] }
    ]
  });
  res.json({ success: true, data: full });
});

const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id);
  if (!po) return res.status(404).json({ success: false, message: 'Purchase order tidak ditemukan' });
  if (po.status !== 'draft') return res.status(400).json({ success: false, message: 'Hanya PO draft yang dapat dihapus' });
  await PurchaseOrderLine.destroy({ where: { purchase_order_id: po.id } });
  await po.destroy();
  res.json({ success: true, message: 'PO dihapus' });
});

const submitPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id);
  if (!po) return res.status(404).json({ success: false, message: 'Purchase order tidak ditemukan' });
  if (po.status !== 'draft') return res.status(400).json({ success: false, message: 'PO sudah disubmit' });
  await po.update({ status: 'submitted' });
  res.json({ success: true, data: po, message: 'PO berhasil disubmit' });
});

const approvePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id);
  if (!po) return res.status(404).json({ success: false, message: 'Purchase order tidak ditemukan' });
  if (po.status !== 'submitted') return res.status(400).json({ success: false, message: 'PO harus disubmit dulu' });
  await po.update({ status: 'approved', approved_by: req.user?.id });
  res.json({ success: true, data: po, message: 'PO disetujui' });
});

// ---------- Purchase Invoices ----------
const listPurchaseInvoices = asyncHandler(async (req, res) => {
  const { supplier_id, product_id, status, branch_id, date_from, date_to, page = 1, limit = 20 } = req.query;
  const where = {};
  if (supplier_id) where.supplier_id = supplier_id;
  if (product_id) where.product_id = product_id;
  if (status) where.status = status;
  if (branch_id) where.branch_id = branch_id;
  if (date_from || date_to) {
    where.invoice_date = {};
    if (date_from) where.invoice_date[Op.gte] = date_from;
    if (date_to) where.invoice_date[Op.lte] = date_to;
  }
  const { count, rows } = await PurchaseInvoice.findAndCountAll({
    where,
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: (Math.max(1, parseInt(page, 10)) - 1) * (parseInt(limit, 10) || 20),
    order: [['invoice_date', 'DESC'], ['created_at', 'DESC']],
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false }
    ]
  });
  res.json({ success: true, data: rows, total: count });
});

const getPurchaseInvoice = asyncHandler(async (req, res) => {
  const inv = await PurchaseInvoice.findByPk(req.params.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name', 'currency', 'payable_account_id'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: PurchaseOrder, as: 'PurchaseOrder', attributes: ['id', 'po_number'], required: false },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: PurchaseInvoiceLine, as: 'Lines', include: [{ model: ChartOfAccount, as: 'Account', attributes: ['id', 'code', 'name'], required: false }], order: [['line_number', 'ASC']] }
    ]
  });
  if (!inv) return res.status(404).json({ success: false, message: 'Faktur pembelian tidak ditemukan' });
  res.json({ success: true, data: inv });
});

const createPurchaseInvoice = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Bukti faktur pembelian (file) wajib diunggah' });
  const proofPath = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.PURCHASE_PROOFS, req.file.filename);

  const { supplier_id, product_id, purchase_order_id, branch_id, invoice_date, due_date, currency, notes, lines: linesRaw } = req.body;
  let lines = [];
  if (linesRaw) {
    try {
      lines = typeof linesRaw === 'string' ? JSON.parse(linesRaw) : linesRaw;
    } catch (_) {}
  }
  const supplier = await AccountingSupplier.findByPk(supplier_id);
  if (!supplier) return res.status(400).json({ success: false, message: 'Supplier tidak ditemukan' });

  const lastInv = await PurchaseInvoice.findOne({ order: [['created_at', 'DESC']], attributes: ['invoice_number'] });
  const nextNum = lastInv ? parseInt((lastInv.invoice_number || '').replace(/\D/g, ''), 10) + 1 : 1;
  const invoice_number = `INVP-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  const inv = await PurchaseInvoice.create({
    invoice_number,
    supplier_id,
    product_id: product_id || null,
    purchase_order_id: purchase_order_id || null,
    branch_id: branch_id || null,
    invoice_date: invoice_date || new Date().toISOString().slice(0, 10),
    due_date: due_date || null,
    status: 'draft',
    currency: currency || 'IDR',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    notes: notes || null,
    proof_file_path: proofPath,
    created_by: req.user?.id
  });

  let subtotal = 0;
  if (Array.isArray(lines) && lines.length) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(l.quantity) || 1;
      const up = parseFloat(l.unit_price) || 0;
      const amt = qty * up;
      subtotal += amt;
      await PurchaseInvoiceLine.create({
        purchase_invoice_id: inv.id,
        line_number: i + 1,
        description: l.description || null,
        quantity: qty,
        unit: l.unit || 'pcs',
        unit_price: up,
        amount: amt,
        purchase_order_line_id: l.purchase_order_line_id || null,
        account_id: l.account_id || null
      });
    }
  }
  const total = subtotal;
  await inv.update({ subtotal, tax_amount: 0, total_amount: total, remaining_amount: total });

  const full = await PurchaseInvoice.findByPk(inv.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: PurchaseInvoiceLine, as: 'Lines', order: [['line_number', 'ASC']] }
    ]
  });
  res.status(201).json({ success: true, data: full });
});

const updatePurchaseInvoice = asyncHandler(async (req, res) => {
  const inv = await PurchaseInvoice.findByPk(req.params.id, { include: [{ model: PurchaseInvoiceLine, as: 'Lines' }] });
  if (!inv) return res.status(404).json({ success: false, message: 'Faktur pembelian tidak ditemukan' });
  if (inv.status !== 'draft') return res.status(400).json({ success: false, message: 'Hanya faktur draft yang dapat diedit' });

  const { product_id, branch_id, invoice_date, due_date, currency, notes, lines } = req.body;
  if (product_id !== undefined) inv.product_id = product_id;
  if (branch_id !== undefined) inv.branch_id = branch_id;
  if (invoice_date) inv.invoice_date = invoice_date;
  if (due_date !== undefined) inv.due_date = due_date;
  if (currency) inv.currency = currency;
  if (notes !== undefined) inv.notes = notes;
  await inv.save();

  if (Array.isArray(lines)) {
    await PurchaseInvoiceLine.destroy({ where: { purchase_invoice_id: inv.id } });
    let subtotal = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(l.quantity) || 1;
      const up = parseFloat(l.unit_price) || 0;
      const amt = qty * up;
      subtotal += amt;
      await PurchaseInvoiceLine.create({
        purchase_invoice_id: inv.id,
        line_number: i + 1,
        description: l.description || null,
        quantity: qty,
        unit: l.unit || 'pcs',
        unit_price: up,
        amount: amt,
        purchase_order_line_id: l.purchase_order_line_id || null,
        account_id: l.account_id || null
      });
    }
    const total = subtotal;
    await inv.update({ subtotal, tax_amount: 0, total_amount: total, remaining_amount: total - (parseFloat(inv.paid_amount) || 0) });
  }

  const full = await PurchaseInvoice.findByPk(inv.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] },
      { model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false },
      { model: PurchaseInvoiceLine, as: 'Lines', order: [['line_number', 'ASC']] }
    ]
  });
  res.json({ success: true, data: full });
});

const deletePurchaseInvoice = asyncHandler(async (req, res) => {
  const inv = await PurchaseInvoice.findByPk(req.params.id);
  if (!inv) return res.status(404).json({ success: false, message: 'Faktur pembelian tidak ditemukan' });
  if (inv.status !== 'draft') return res.status(400).json({ success: false, message: 'Hanya faktur draft yang dapat dihapus' });
  await PurchasePayment.destroy({ where: { purchase_invoice_id: inv.id } });
  await PurchaseInvoiceLine.destroy({ where: { purchase_invoice_id: inv.id } });
  if (inv.proof_file_path) {
    const fp = getProofFilePath(inv.proof_file_path);
    if (fp && fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
  }
  await inv.destroy();
  res.json({ success: true, message: 'Faktur pembelian dihapus' });
});

/** Hapus semua data pembelian draft untuk satu product (PO draft, Faktur draft, Pembayaran terkait). */
const deletePurchasingByProduct = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id wajib' });
  const product = await Product.findByPk(product_id, { attributes: ['id', 'name'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });

  let deletedPayments = 0;
  let deletedInvoices = 0;
  let deletedOrders = 0;

  const draftInvoices = await PurchaseInvoice.findAll({
    where: { product_id, status: 'draft' },
    attributes: ['id', 'proof_file_path']
  });
  for (const inv of draftInvoices) {
    const payCount = await PurchasePayment.count({ where: { purchase_invoice_id: inv.id } });
    await PurchasePayment.destroy({ where: { purchase_invoice_id: inv.id } });
    deletedPayments += payCount;
    await PurchaseInvoiceLine.destroy({ where: { purchase_invoice_id: inv.id } });
    if (inv.proof_file_path) {
      const fp = getProofFilePath(inv.proof_file_path);
      if (fp && fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
    }
    await inv.destroy();
    deletedInvoices += 1;
  }

  const draftOrders = await PurchaseOrder.findAll({
    where: { product_id, status: 'draft' },
    attributes: ['id', 'proof_file_path']
  });
  for (const po of draftOrders) {
    await PurchaseOrderLine.destroy({ where: { purchase_order_id: po.id } });
    if (po.proof_file_path) {
      const fp = getProofFilePath(po.proof_file_path);
      if (fp && fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
    }
    await po.destroy();
    deletedOrders += 1;
  }

  res.json({
    success: true,
    message: `Data pembelian draft untuk product "${product.name}" dihapus`,
    data: { deleted_orders: deletedOrders, deleted_invoices: deletedInvoices, deleted_payments: deletedPayments }
  });
});

const postPurchaseInvoice = asyncHandler(async (req, res) => {
  const inv = await PurchaseInvoice.findByPk(req.params.id, {
    include: [
      { model: AccountingSupplier, as: 'Supplier', include: [{ model: ChartOfAccount, as: 'PayableAccount', required: false }] },
      { model: PurchaseInvoiceLine, as: 'Lines', include: [{ model: ChartOfAccount, as: 'Account', required: false }], order: [['line_number', 'ASC']] }
    ]
  });
  if (!inv) return res.status(404).json({ success: false, message: 'Faktur pembelian tidak ditemukan' });
  if (inv.status !== 'draft') return res.status(400).json({ success: false, message: 'Faktur sudah diposting' });
  if (inv.journal_entry_id) return res.status(400).json({ success: false, message: 'Faktur sudah punya jurnal' });

  const period = await getPeriodByDate(inv.invoice_date);
  if (!period) return res.status(400).json({ success: false, message: 'Periode akuntansi untuk tanggal faktur tidak ditemukan atau terkunci' });

  const journalNumber = await nextJournalNumber('JEP');
  const totalAmount = parseFloat(inv.total_amount) || 0;
  const payableAccountId = inv.Supplier?.PayableAccount?.id || inv.Supplier?.payable_account_id;
  if (!payableAccountId) return res.status(400).json({ success: false, message: 'Supplier belum punya akun hutang (payable)' });

  const je = await JournalEntry.create({
    journal_number: journalNumber,
    period_id: period.id,
    entry_date: inv.invoice_date,
    journal_type: 'purchase',
    source_type: 'purchase_invoice',
    source_id: inv.id,
    branch_id: inv.branch_id,
    description: `Faktur pembelian ${inv.invoice_number}`,
    status: 'posted',
    total_debit: totalAmount,
    total_credit: totalAmount,
    currency: inv.currency,
    posted_by: req.user?.id,
    posted_at: new Date()
  });

  let sortOrder = 0;
  for (const line of inv.Lines || []) {
    const accId = line.account_id || line.Account?.id;
    const amt = parseFloat(line.amount) || 0;
    if (accId && amt > 0) {
      await JournalEntryLine.create({
        journal_entry_id: je.id,
        account_id: accId,
        debit_amount: amt,
        credit_amount: 0,
        line_description: line.description || null,
        reference_type: 'purchase_invoice_line',
        reference_id: line.id,
        sort_order: ++sortOrder
      });
    }
  }
  await JournalEntryLine.create({
    journal_entry_id: je.id,
    account_id: payableAccountId,
    debit_amount: 0,
    credit_amount: totalAmount,
    line_description: `Hutang ${inv.Supplier?.name || ''}`,
    reference_type: 'purchase_invoice',
    reference_id: inv.id,
    sort_order: ++sortOrder
  });

  await inv.update({ journal_entry_id: je.id, status: 'posted', posted_by: req.user?.id, posted_at: new Date() });

  const updated = await PurchaseInvoice.findByPk(inv.id, {
    include: [{ model: JournalEntry, as: 'JournalEntry', attributes: ['id', 'journal_number', 'entry_date'] }]
  });
  res.json({ success: true, data: updated, message: 'Faktur pembelian berhasil diposting' });
});

// ---------- Purchase Payments ----------
const listPurchasePayments = asyncHandler(async (req, res) => {
  const { purchase_invoice_id, supplier_id, product_id, status, page = 1, limit = 20 } = req.query;
  const where = {};
  if (purchase_invoice_id) where.purchase_invoice_id = purchase_invoice_id;
  if (supplier_id) where.supplier_id = supplier_id;
  if (status) where.status = status;
  const include = [
    { model: PurchaseInvoice, as: 'PurchaseInvoice', attributes: ['id', 'invoice_number', 'product_id', 'total_amount', 'remaining_amount'], ...(product_id ? { where: { product_id } } : {}) },
    { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] }
  ];
  if (product_id) include[0].required = true;
  const { count, rows } = await PurchasePayment.findAndCountAll({
    where,
    limit: Math.min(parseInt(limit, 10) || 20, 100),
    offset: (Math.max(1, parseInt(page, 10)) - 1) * (parseInt(limit, 10) || 20),
    order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
    include
  });
  res.json({ success: true, data: rows, total: count });
});

const getPurchasePayment = asyncHandler(async (req, res) => {
  const pay = await PurchasePayment.findByPk(req.params.id, {
    include: [
      { model: PurchaseInvoice, as: 'PurchaseInvoice', attributes: ['id', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount'] },
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name', 'payable_account_id'] },
      { model: AccountingBankAccount, as: 'BankAccount', attributes: ['id', 'name', 'account_number', 'gl_account_id'], required: false }
    ]
  });
  if (!pay) return res.status(404).json({ success: false, message: 'Pembayaran pembelian tidak ditemukan' });
  res.json({ success: true, data: pay });
});

const createPurchasePayment = asyncHandler(async (req, res) => {
  const { purchase_invoice_id, payment_date, amount, currency, payment_method, bank_account_id, reference_number, notes } = req.body;
  const inv = await PurchaseInvoice.findByPk(purchase_invoice_id);
  if (!inv) return res.status(400).json({ success: false, message: 'Faktur pembelian tidak ditemukan' });
  if (inv.status !== 'posted') return res.status(400).json({ success: false, message: 'Faktur harus diposting dulu' });

  const amt = parseFloat(amount) || 0;
  if (amt <= 0) return res.status(400).json({ success: false, message: 'Jumlah pembayaran harus > 0' });
  const remaining = parseFloat(inv.remaining_amount) || 0;
  if (amt > remaining) return res.status(400).json({ success: false, message: 'Jumlah melebihi sisa tagihan' });

  const lastPay = await PurchasePayment.findOne({ order: [['created_at', 'DESC']], attributes: ['payment_number'] });
  const nextNum = lastPay ? parseInt((lastPay.payment_number || '').replace(/\D/g, ''), 10) + 1 : 1;
  const payment_number = `PAYP-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  const pay = await PurchasePayment.create({
    payment_number,
    purchase_invoice_id,
    supplier_id: inv.supplier_id,
    payment_date: payment_date || new Date().toISOString().slice(0, 10),
    amount: amt,
    currency: currency || inv.currency,
    payment_method: payment_method || 'transfer',
    bank_account_id: bank_account_id || null,
    status: 'draft',
    reference_number: reference_number || null,
    notes: notes || null,
    created_by: req.user?.id
  });

  const updatedInv = await inv.reload();
  const newPaid = parseFloat(updatedInv.paid_amount) || 0 + amt;
  const newRemaining = Math.max(0, parseFloat(updatedInv.total_amount) || 0 - newPaid);
  await inv.update({
    paid_amount: newPaid,
    remaining_amount: newRemaining,
    status: newRemaining <= 0 ? 'paid' : 'partial_paid'
  });

  const full = await PurchasePayment.findByPk(pay.id, {
    include: [
      { model: PurchaseInvoice, as: 'PurchaseInvoice', attributes: ['id', 'invoice_number'] },
      { model: AccountingSupplier, as: 'Supplier', attributes: ['id', 'code', 'name'] }
    ]
  });
  res.status(201).json({ success: true, data: full });
});

const postPurchasePayment = asyncHandler(async (req, res) => {
  const pay = await PurchasePayment.findByPk(req.params.id, {
    include: [
      { model: PurchaseInvoice, as: 'PurchaseInvoice' },
      { model: AccountingSupplier, as: 'Supplier', include: [{ model: ChartOfAccount, as: 'PayableAccount', required: false }] },
      { model: AccountingBankAccount, as: 'BankAccount', include: [{ model: ChartOfAccount, as: 'GlAccount', required: false }] }
    ]
  });
  if (!pay) return res.status(404).json({ success: false, message: 'Pembayaran pembelian tidak ditemukan' });
  if (pay.status !== 'draft') return res.status(400).json({ success: false, message: 'Pembayaran sudah diposting' });
  if (pay.journal_entry_id) return res.status(400).json({ success: false, message: 'Pembayaran sudah punya jurnal' });

  const period = await getPeriodByDate(pay.payment_date);
  if (!period) return res.status(400).json({ success: false, message: 'Periode akuntansi untuk tanggal pembayaran tidak ditemukan atau terkunci' });

  const payableAccountId = pay.Supplier?.PayableAccount?.id || pay.Supplier?.payable_account_id;
  const bankGlId = (pay.BankAccount && pay.BankAccount.GlAccount && pay.BankAccount.GlAccount.id) || pay.BankAccount?.gl_account_id;
  if (!payableAccountId) return res.status(400).json({ success: false, message: 'Supplier belum punya akun hutang' });
  if (!bankGlId) return res.status(400).json({ success: false, message: 'Rekening bank belum punya akun GL' });

  const amt = parseFloat(pay.amount) || 0;
  const journalNumber = await nextJournalNumber('JEB');
  const je = await JournalEntry.create({
    journal_number: journalNumber,
    period_id: period.id,
    entry_date: pay.payment_date,
    journal_type: 'bank',
    source_type: 'purchase_payment',
    source_id: pay.id,
    branch_id: pay.PurchaseInvoice?.branch_id,
    description: `Pembayaran pembelian ${pay.payment_number} - ${pay.PurchaseInvoice?.invoice_number}`,
    status: 'posted',
    total_debit: amt,
    total_credit: amt,
    currency: pay.currency,
    posted_by: req.user?.id,
    posted_at: new Date()
  });

  await JournalEntryLine.create({
    journal_entry_id: je.id,
    account_id: payableAccountId,
    debit_amount: amt,
    credit_amount: 0,
    line_description: `Bayar hutang ${pay.Supplier?.name || ''}`,
    reference_type: 'purchase_payment',
    reference_id: pay.id,
    sort_order: 1
  });
  await JournalEntryLine.create({
    journal_entry_id: je.id,
    account_id: bankGlId,
    debit_amount: 0,
    credit_amount: amt,
    line_description: pay.reference_number || `Payment ${pay.payment_number}`,
    reference_type: 'purchase_payment',
    reference_id: pay.id,
    sort_order: 2
  });

  await pay.update({ journal_entry_id: je.id, status: 'posted', posted_by: req.user?.id, posted_at: new Date() });

  const updated = await PurchasePayment.findByPk(pay.id, {
    include: [{ model: JournalEntry, as: 'JournalEntry', attributes: ['id', 'journal_number', 'entry_date'] }]
  });
  res.json({ success: true, data: updated, message: 'Pembayaran berhasil diposting' });
});

// ---------- Purchasing Summary (per product) ----------
const getPurchasingSummary = asyncHandler(async (req, res) => {
  const { fn, col } = require('sequelize');

  const products = await Product.findAll({
    where: { is_active: true },
    attributes: ['id', 'code', 'name', 'type'],
    order: [['type', 'ASC'], ['code', 'ASC']]
  });

  const poCounts = await PurchaseOrder.findAll({
    attributes: ['product_id', [fn('COUNT', col('id')), 'count']],
    group: ['product_id'],
    raw: true
  });
  const invStats = await PurchaseInvoice.findAll({
    attributes: [
      'product_id',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('total_amount')), 'total_amount'],
      [fn('SUM', col('paid_amount')), 'paid_amount'],
      [fn('SUM', col('remaining_amount')), 'remaining_amount']
    ],
    group: ['product_id'],
    raw: true
  });

  const poByProduct = {};
  poCounts.forEach((r) => { poByProduct[r.product_id || ''] = parseInt(r.count, 10) || 0; });
  const invByProduct = {};
  invStats.forEach((r) => {
    invByProduct[r.product_id || ''] = {
      count: parseInt(r.count, 10) || 0,
      total_amount: parseFloat(r.total_amount) || 0,
      paid_amount: parseFloat(r.paid_amount) || 0,
      remaining_amount: parseFloat(r.remaining_amount) || 0
    };
  });

  const suppliersCount = await AccountingSupplier.count({ where: { is_active: true } });

  const by_product = products.map((p) => ({
    product_id: p.id,
    product_code: p.code,
    product_name: p.name,
    product_type: p.type,
    po_count: poByProduct[p.id] || 0,
    invoice_count: (invByProduct[p.id] && invByProduct[p.id].count) || 0,
    total_amount: (invByProduct[p.id] && invByProduct[p.id].total_amount) || 0,
    paid_amount: (invByProduct[p.id] && invByProduct[p.id].paid_amount) || 0,
    remaining_amount: (invByProduct[p.id] && invByProduct[p.id].remaining_amount) || 0
  }));

  res.json({
    success: true,
    data: {
      products,
      by_product,
      suppliers_count: suppliersCount
    }
  });
});

function getProofFilePath(proofUrlOrPath) {
  if (!proofUrlOrPath) return null;
  const urlNorm = String(proofUrlOrPath).replace(/\\/g, '/').trim();
  const match = urlNorm.match(/purchase-proofs\/?(.+)$/i);
  const filename = match ? match[1].replace(/^\/+/, '').split('/').pop() : null;
  return filename ? path.join(proofDir, filename) : null;
}

const getPurchaseOrderProofFile = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id, { attributes: ['id', 'proof_file_path'] });
  if (!po || !po.proof_file_path) return res.status(404).json({ success: false, message: 'Bukti tidak ditemukan' });
  const filePath = getProofFilePath(po.proof_file_path);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

const getPurchaseInvoiceProofFile = asyncHandler(async (req, res) => {
  const inv = await PurchaseInvoice.findByPk(req.params.id, { attributes: ['id', 'proof_file_path'] });
  if (!inv || !inv.proof_file_path) return res.status(404).json({ success: false, message: 'Bukti tidak ditemukan' });
  const filePath = getProofFilePath(inv.proof_file_path);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = {
  uploadPurchaseOrderProof,
  uploadPurchaseInvoiceProof,
  getPurchasingSummary,
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  getPurchaseOrderProofFile,
  listPurchaseInvoices,
  getPurchaseInvoice,
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
  postPurchaseInvoice,
  getPurchaseInvoiceProofFile,
  listPurchasePayments,
  getPurchasePayment,
  createPurchasePayment,
  postPurchasePayment,
  deletePurchasingByProduct
};
