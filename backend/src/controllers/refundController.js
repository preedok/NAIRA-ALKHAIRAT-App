const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const asyncHandler = require('express-async-handler');
const { Refund, Invoice, Order, User, OwnerProfile, OwnerBalanceTransaction, InvoiceStatusHistory, Notification } = require('../models');
const { REFUND_STATUS, REFUND_SOURCE, INVOICE_STATUS, NOTIFICATION_TRIGGER, isOwnerRole } = require('../constants');
const uploadConfig = require('../config/uploads');
const { sendRefundProofToOwner } = require('../utils/emailService');

const REFUND_STATUS_LABELS = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };

const refundProofDir = uploadConfig.getDir(uploadConfig.SUBDIRS.REFUND_PROOFS);
const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const refundProofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, refundProofDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    cb(null, `REFUND_${(req.params.id || '').slice(-6)}_${date}_${time}${ext}`);
  }
});
const refundProofUpload = multer({ storage: refundProofStorage, limits: { fileSize: 10 * 1024 * 1024 } });

async function logInvoiceStatusChange({ invoice_id, from_status, to_status, changed_by, reason, meta }) {
  try {
    await InvoiceStatusHistory.create({
      invoice_id,
      from_status: from_status ?? null,
      to_status,
      changed_at: new Date(),
      changed_by: changed_by || null,
      reason: reason || null,
      meta: meta && typeof meta === 'object' ? meta : {}
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('refundController logInvoiceStatusChange failed:', e?.message || e);
  }
}

/**
 * POST /api/v1/refunds (request refund dari saldo - owner)
 * Body: { amount, bank_name, account_number } untuk tarik saldo ke rekening.
 */
const createFromBalance = asyncHandler(async (req, res) => {
  if (!isOwnerRole(req.user.role)) return res.status(403).json({ success: false, message: 'Hanya owner yang dapat meminta refund dari saldo' });
  const { amount: amountRaw, bank_name, account_number } = req.body || {};
  const amount = parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'amount wajib angka positif' });
  const bank = bank_name ? String(bank_name).trim() : '';
  const account = account_number ? String(account_number).trim() : '';
  if (!bank || !account) return res.status(400).json({ success: false, message: 'bank_name dan account_number wajib diisi' });

  const profile = await OwnerProfile.findOne({ where: { user_id: req.user.id } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil owner tidak ditemukan' });
  const balance = parseFloat(profile.balance) || 0;
  if (balance < amount) return res.status(400).json({ success: false, message: `Saldo tidak cukup. Saldo: Rp ${balance.toLocaleString('id-ID')}` });

  const r = await Refund.create({
    invoice_id: null,
    order_id: null,
    owner_id: req.user.id,
    amount,
    status: REFUND_STATUS.REQUESTED,
    source: REFUND_SOURCE.BALANCE,
    bank_name: bank,
    account_number: account,
    reason: 'Penarikan saldo ke rekening',
    requested_by: req.user.id
  });

  const full = await Refund.findByPk(r.id, {
    include: [{ model: User, as: 'Owner', attributes: ['id', 'name'], required: false }]
  });
  res.status(201).json({ success: true, data: full, message: 'Permintaan refund saldo telah dicatat. Admin/accounting akan memproses.' });
});

/** Build where for list/stats (status, owner_id, date_from, date_to, source) */
function buildRefundWhere(req) {
  const { status, owner_id, date_from, date_to, source } = req.query;
  const where = {};
  if (status) where.status = status;
  if (isOwnerRole(req.user.role)) where.owner_id = req.user.id;
  else if (owner_id) where.owner_id = owner_id;
  if (source) where.source = source;
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  return where;
}

/**
 * GET /api/v1/refunds/stats
 * Counts and amounts by status (same scope as list).
 */
const getStats = asyncHandler(async (req, res) => {
  const where = buildRefundWhere(req);
  const sequelize = Refund.sequelize;

  const total = await Refund.count({ where });

  const rows = await Refund.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count'], [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'total_amount']],
    group: ['status'],
    raw: true
  });

  const byStatus = { requested: 0, approved: 0, rejected: 0, refunded: 0 };
  const amountByStatus = { requested: 0, approved: 0, rejected: 0, refunded: 0 };
  rows.forEach((r) => {
    byStatus[r.status] = parseInt(r.count, 10) || 0;
    amountByStatus[r.status] = parseFloat(r.total_amount) || 0;
  });

  const totalAmountRequested = amountByStatus.requested + amountByStatus.approved;
  const totalAmountRefunded = amountByStatus.refunded;

  res.json({
    success: true,
    data: {
      total_refunds: total,
      requested: byStatus.requested,
      approved: byStatus.approved,
      rejected: byStatus.rejected,
      refunded: byStatus.refunded,
      amount_requested: totalAmountRequested,
      amount_refunded: totalAmountRefunded,
      amount_pending: amountByStatus.requested,
      by_status: byStatus,
      amount_by_status: amountByStatus
    }
  });
});

/**
 * GET /api/v1/refunds
 * Admin pusat & accounting: semua permintaan refund. Owner: hanya milik sendiri.
 */
const list = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1 } = req.query;
  const where = buildRefundWhere(req);

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

  const { rows, count } = await Refund.findAndCountAll({
    where,
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status', 'order_id', 'total_amount', 'paid_amount'], required: false },
      { model: Order, as: 'Order', attributes: ['id', 'order_number'], required: false },
      { model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'company_name'], required: false },
      { model: User, as: 'RequestedBy', attributes: ['id', 'name'], required: false },
      { model: User, as: 'ApprovedBy', attributes: ['id', 'name'], required: false }
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset,
    distinct: true
  });

  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page: Math.floor(offset / lim) + 1, limit: lim, totalPages: Math.ceil(count / lim) || 1 },
    status_labels: REFUND_STATUS_LABELS
  });
});

/**
 * GET /api/v1/refunds/:id
 */
const getById = asyncHandler(async (req, res) => {
  const r = await Refund.findByPk(req.params.id, {
    include: [
      { model: Invoice, as: 'Invoice', required: false },
      { model: Order, as: 'Order', required: false },
      { model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'company_name'], required: false },
      { model: User, as: 'RequestedBy', attributes: ['id', 'name'], required: false },
      { model: User, as: 'ApprovedBy', attributes: ['id', 'name'], required: false }
    ]
  });
  if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });
  if (isOwnerRole(req.user.role) && r.owner_id !== req.user.id) return res.status(403).json({ success: false, message: 'Akses ditolak' });
  res.json({ success: true, data: r, status_labels: REFUND_STATUS_LABELS });
});

/**
 * PATCH /api/v1/refunds/:id
 * Admin pusat & accounting: update status (approved, rejected, refunded).
 * Body: { status: 'approved'|'rejected'|'refunded', rejection_reason? }
 * Saat status = refunded dan source = balance: kurangi saldo owner.
 */
const updateStatus = asyncHandler(async (req, res) => {
  const allowed = ['admin_pusat', 'super_admin', 'role_accounting'].includes(req.user.role);
  if (!allowed) return res.status(403).json({ success: false, message: 'Hanya admin pusat dan accounting yang dapat memproses refund' });

  const r = await Refund.findByPk(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });

  const { status, rejection_reason } = req.body || {};
  const valid = [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED, REFUND_STATUS.REFUNDED].includes(status);
  if (!valid) return res.status(400).json({ success: false, message: 'status harus approved, rejected, atau refunded' });

  if (status === REFUND_STATUS.REJECTED && rejection_reason) await r.update({ rejection_reason: String(rejection_reason).trim() });

  const updates = { status };
  if (status === REFUND_STATUS.APPROVED || status === REFUND_STATUS.REFUNDED) {
    updates.approved_by = req.user.id;
    updates.approved_at = new Date();
  }
  if (status === REFUND_STATUS.REFUNDED) updates.refunded_at = new Date();

  await r.update(updates);

  // Jika refund terkait invoice, simpan jejak proses dan update status invoice saat refund selesai.
  if (r.invoice_id) {
    const inv = await Invoice.findByPk(r.invoice_id);
    if (inv) {
      if (status === REFUND_STATUS.APPROVED) {
        await logInvoiceStatusChange({
          invoice_id: inv.id,
          from_status: inv.status,
          to_status: inv.status,
          changed_by: req.user.id,
          reason: 'refund_approved',
          meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 }
        });
      } else if (status === REFUND_STATUS.REJECTED) {
        await logInvoiceStatusChange({
          invoice_id: inv.id,
          from_status: inv.status,
          to_status: inv.status,
          changed_by: req.user.id,
          reason: 'refund_rejected',
          meta: { refund_id: r.id, rejection_reason: rejection_reason ? String(rejection_reason).trim() : null }
        });
      } else if (status === REFUND_STATUS.REFUNDED) {
        await logInvoiceStatusChange({
          invoice_id: inv.id,
          from_status: inv.status,
          to_status: INVOICE_STATUS.REFUNDED,
          changed_by: req.user.id,
          reason: 'refund_refunded',
          meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 }
        });
        await inv.update({ status: INVOICE_STATUS.REFUNDED });
      }
    }
  }

  if (status === REFUND_STATUS.REFUNDED && r.source === REFUND_SOURCE.BALANCE && r.owner_id) {
    const profile = await OwnerProfile.findOne({ where: { user_id: r.owner_id } });
    if (profile) {
      const current = parseFloat(profile.balance) || 0;
      const amount = parseFloat(r.amount) || 0;
      const newBalance = Math.max(0, current - amount);
      await profile.update({ balance: newBalance });
      await OwnerBalanceTransaction.create({
        owner_id: r.owner_id,
        amount: -amount,
        type: 'refund_debit',
        reference_type: 'refund',
        reference_id: r.id,
        notes: `Refund saldo ke rekening. Saldo -${amount.toLocaleString('id-ID')}`
      });
    }
  }

  const updated = await Refund.findByPk(r.id, {
    include: [
      { model: User, as: 'Owner', attributes: ['id', 'name'], required: false },
      { model: User, as: 'ApprovedBy', attributes: ['id', 'name'], required: false }
    ]
  });
  res.json({ success: true, data: updated, message: `Status refund diubah menjadi ${REFUND_STATUS_LABELS[status] || status}` });
});

/**
 * POST /api/v1/refunds/:id/upload-proof
 * Role accounting: upload bukti bayar refund. Setelah upload, bukti dikirim ke email pemesan (owner).
 */
const uploadProof = [
  refundProofUpload.single('proof_file'),
  asyncHandler(async (req, res) => {
    const allowed = ['admin_pusat', 'super_admin', 'role_accounting'].includes(req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: 'Hanya admin pusat dan accounting yang dapat upload bukti refund' });

    const r = await Refund.findByPk(req.params.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'], required: false },
        { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], required: false }
      ]
    });
    if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });
    if (!req.file || !req.file.path) return res.status(400).json({ success: false, message: 'File bukti refund wajib' });

    const finalName = uploadConfig.refundProofFilename(r.id, r.Invoice?.invoice_number, req.file.originalname);
    const oldPath = req.file.path;
    const newPath = path.join(refundProofDir, finalName);
    try { fs.renameSync(oldPath, newPath); } catch (e) { /* keep temp name */ }
    const savedName = fs.existsSync(newPath) ? finalName : path.basename(oldPath);
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REFUND_PROOFS, savedName);

    const wasRefunded = r.status === REFUND_STATUS.REFUNDED;
    await r.update({
      proof_file_url: fileUrl,
      ...(wasRefunded ? {} : { status: REFUND_STATUS.REFUNDED, refunded_at: new Date(), approved_by: req.user.id, approved_at: new Date() })
    });

    if (r.invoice_id) {
      const inv = await Invoice.findByPk(r.invoice_id);
      if (inv && !wasRefunded) {
        await logInvoiceStatusChange({
          invoice_id: inv.id,
          from_status: inv.status,
          to_status: INVOICE_STATUS.REFUNDED,
          changed_by: req.user.id,
          reason: 'refund_refunded',
          meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 }
        });
        await inv.update({ status: INVOICE_STATUS.REFUNDED });
      }
    }

    const ownerEmail = r.Owner?.email || null;
    const proofPath = fs.existsSync(newPath) ? newPath : oldPath;
    let emailSent = false;
    if (ownerEmail) {
      emailSent = await sendRefundProofToOwner(
        ownerEmail,
        r.Owner?.name || 'Pemesan',
        parseFloat(r.amount) || 0,
        r.Invoice?.invoice_number || '',
        proofPath
      );
    }
    await Notification.create({
      user_id: r.owner_id,
      trigger: NOTIFICATION_TRIGGER.REFUND,
      title: 'Refund diproses – bukti terkirim',
      message: `Refund untuk invoice ${r.Invoice?.invoice_number || ''} telah diproses. Bukti transfer telah dikirim ke email Anda.`,
      data: { refund_id: r.id, invoice_id: r.invoice_id, proof_file_url: r.proof_file_url },
      channel_in_app: true,
      channel_email: true,
      ...(emailSent ? { email_sent_at: new Date() } : {})
    });

    const updated = await Refund.findByPk(r.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'], required: false },
        { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], required: false }
      ]
    });
    res.json({
      success: true,
      data: updated,
      message: 'Bukti refund berhasil diupload.' + (ownerEmail ? ' Email bukti refund telah dikirim ke pemesan.' : '')
    });
  })
];

/**
 * GET /api/v1/refunds/:id/proof/file
 * Stream file bukti refund (owner & accounting bisa akses).
 */
const getProofFile = asyncHandler(async (req, res) => {
  const r = await Refund.findByPk(req.params.id, { attributes: ['id', 'proof_file_url', 'owner_id'] });
  if (!r || !r.proof_file_url) return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  const canAccess = isOwnerRole(req.user.role) ? r.owner_id === req.user.id : ['admin_pusat', 'super_admin', 'role_accounting', 'invoice_koordinator', 'invoice_saudi'].includes(req.user.role);
  if (!canAccess) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  const urlNorm = (r.proof_file_url || '').replace(/\\/g, '/').trim();
  let filename = null;
  const match = urlNorm.match(/refund-proofs\/?(.+)$/i);
  if (match) filename = match[1].replace(/^\/+/, '').split('/').pop();
  if (!filename) filename = path.basename(urlNorm);
  if (!filename || filename === '.' || filename === '..') return res.status(404).json({ success: false, message: 'Path tidak valid' });
  const filePath = path.join(refundProofDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada di server' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const safeName = filename.replace(/[^\w.\-]/g, '_');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = { getStats, list, getById, updateStatus, createFromBalance, uploadProof, getProofFile };
