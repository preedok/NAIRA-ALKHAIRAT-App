const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op, Transaction } = require('sequelize');
const asyncHandler = require('express-async-handler');
const { Refund, Invoice, Order, User, OwnerProfile, OwnerBalanceTransaction, InvoiceStatusHistory, Notification, sequelize } = require('../models');
const { REFUND_STATUS, REFUND_SOURCE, INVOICE_STATUS, NOTIFICATION_TRIGGER, isOwnerRole } = require('../constants');
const uploadConfig = require('../config/uploads');
const { sendRefundProofToOwner } = require('../utils/emailService');

const REFUND_STATUS_LABELS = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };

/** Penarikan saldo: source balance, atau data lama tanpa invoice/order + alasan penarikan. */
function isBalanceWithdrawalRefund(refundRow) {
  if (!refundRow) return false;
  const src = String(refundRow.source != null ? refundRow.source : '').trim().toLowerCase();
  if (src === 'balance') return true;
  const inv = refundRow.invoice_id;
  const ord = refundRow.order_id;
  if (inv || ord) return false;
  if (!refundRow.owner_id) return false;
  const reason = String(refundRow.reason || '').toLowerCase();
  return reason.includes('penarikan') && reason.includes('saldo');
}

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

/** ISO string dari frontend: tanggal/waktu di bukti transfer (waktu lokal → UTC). */
function parseTransferProofAt(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, code: 400, message: 'Tanggal dan waktu di bukti transfer wajib diisi (sesuai struk).' };
  }
  const d = new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) {
    return { ok: false, code: 400, message: 'Format tanggal/waktu bukti transfer tidak valid.' };
  }
  return { ok: true, date: d };
}

/**
 * Potong saldo untuk penarikan: jika sudah ada refund_debit → lewati; jika ada withdrawal_pending → ubah jadi refund_debit (saldo sudah dipotong saat pengajuan);
 * selain itu potong saldo sekarang (data lama / sinkron).
 * @returns {{ ok: true } | { ok: false, code: number, message: string }}
 */
async function applyBalanceRefundDebitIfNeeded(refundRow, { transaction } = {}) {
  if (!refundRow || !isBalanceWithdrawalRefund(refundRow) || !refundRow.owner_id) {
    return { ok: true };
  }
  const existing = await OwnerBalanceTransaction.findOne({
    where: { reference_type: 'refund', reference_id: refundRow.id, type: 'refund_debit' },
    transaction
  });
  if (existing) return { ok: true };

  const pending = await OwnerBalanceTransaction.findOne({
    where: { reference_type: 'refund', reference_id: refundRow.id, type: 'withdrawal_pending' },
    transaction
  });
  if (pending) {
    await pending.update(
      {
        type: 'refund_debit',
        notes: 'Penarikan saldo — disetujui/selesai diproses. (Saldo dipotong saat pengajuan.)'
      },
      { transaction }
    );
    return { ok: true };
  }

  const amount = parseFloat(refundRow.amount) || 0;
  if (amount <= 0) return { ok: false, code: 400, message: 'Jumlah refund tidak valid' };

  const profile = await OwnerProfile.findOne({ where: { user_id: refundRow.owner_id }, transaction });
  if (!profile) return { ok: false, code: 400, message: 'Profil owner tidak ditemukan' };

  const current = parseFloat(profile.balance) || 0;
  if (current < amount) {
    return {
      ok: false,
      code: 400,
      message: `Saldo owner tidak cukup untuk menyelesaikan penarikan (tersisa Rp ${current.toLocaleString('id-ID')}, dibutuhkan Rp ${amount.toLocaleString('id-ID')}).`
    };
  }

  const newBalance = Math.max(0, current - amount);
  await profile.update({ balance: newBalance }, { transaction });
  await OwnerBalanceTransaction.create(
    {
      owner_id: refundRow.owner_id,
      amount: -amount,
      type: 'refund_debit',
      reference_type: 'refund',
      reference_id: refundRow.id,
      notes: `Penarikan saldo ke rekening — disetujui/diproses. Saldo -${amount.toLocaleString('id-ID')}`
    },
    { transaction }
  );
  return { ok: true };
}

/**
 * Penarikan ditolak: kembalikan saldo jika sudah dipotong (withdrawal_pending atau refund_debit).
 * @returns {{ ok: true, restored?: boolean } | { ok: false, code: number, message: string }}
 */
async function reverseBalanceWithdrawalOnReject(refundRow, { transaction, rejectionReason } = {}) {
  if (!refundRow || !isBalanceWithdrawalRefund(refundRow) || !refundRow.owner_id) {
    return { ok: true, restored: false };
  }
  const amt = parseFloat(refundRow.amount) || 0;
  const amtStr = amt.toLocaleString('id-ID');
  const reasonSuffix = rejectionReason ? ` Alasan: ${rejectionReason}` : '';

  const pendingRow = await OwnerBalanceTransaction.findOne({
    where: { reference_type: 'refund', reference_id: refundRow.id, type: 'withdrawal_pending' },
    transaction
  });
  if (pendingRow) {
    const debited = Math.abs(parseFloat(pendingRow.amount)) || amt;
    const profile = await OwnerProfile.findOne({ where: { user_id: refundRow.owner_id }, transaction });
    if (!profile) return { ok: false, code: 400, message: 'Profil owner tidak ditemukan' };
    const current = parseFloat(profile.balance) || 0;
    await profile.update({ balance: current + debited }, { transaction });
    await OwnerBalanceTransaction.create(
      {
        owner_id: refundRow.owner_id,
        amount: debited,
        type: 'adjustment',
        reference_type: 'refund',
        reference_id: refundRow.id,
        notes: `Pengajuan penarikan saldo Rp ${amtStr} ditolak — saldo dikembalikan (+${debited.toLocaleString('id-ID')}).${reasonSuffix}`
      },
      { transaction }
    );
    await pendingRow.destroy({ transaction });
    return { ok: true, restored: true };
  }

  const existingDebit = await OwnerBalanceTransaction.findOne({
    where: { reference_type: 'refund', reference_id: refundRow.id, type: 'refund_debit' },
    transaction
  });

  if (existingDebit) {
    const debited = Math.abs(parseFloat(existingDebit.amount)) || 0;
    const profile = await OwnerProfile.findOne({ where: { user_id: refundRow.owner_id }, transaction });
    if (!profile) return { ok: false, code: 400, message: 'Profil owner tidak ditemukan' };
    const current = parseFloat(profile.balance) || 0;
    await profile.update({ balance: current + debited }, { transaction });
    await OwnerBalanceTransaction.create(
      {
        owner_id: refundRow.owner_id,
        amount: debited,
        type: 'adjustment',
        reference_type: 'refund',
        reference_id: refundRow.id,
        notes: `Penarikan saldo Rp ${amtStr} ditolak — saldo dikembalikan (+${debited.toLocaleString('id-ID')}).${reasonSuffix}`
      },
      { transaction }
    );
    return { ok: true, restored: true };
  }

  await OwnerBalanceTransaction.create(
    {
      owner_id: refundRow.owner_id,
      amount: 0,
      type: 'adjustment',
      reference_type: 'refund',
      reference_id: refundRow.id,
      notes: `Pengajuan penarikan saldo Rp ${amtStr} ditolak. Saldo tidak berubah.${reasonSuffix}`
    },
    { transaction }
  );
  return { ok: true, restored: false };
}

async function logInvoiceStatusChange({ invoice_id, from_status, to_status, changed_by, reason, meta, transaction }) {
  try {
    await InvoiceStatusHistory.create({
      invoice_id,
      from_status: from_status ?? null,
      to_status,
      changed_at: new Date(),
      changed_by: changed_by || null,
      reason: reason || null,
      meta: meta && typeof meta === 'object' ? meta : {}
    }, transaction ? { transaction } : {});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('refundController logInvoiceStatusChange failed:', e?.message || e);
  }
}

/**
 * POST /api/v1/refunds (request refund dari saldo - owner)
 * Body owner: { amount, bank_name, account_number, account_holder_name }.
 * Body admin/tim invoice: + { owner_id } untuk ajukan atas nama owner.
 * Flow terbaru: saldo owner dipotong saat refund selesai (status refunded + bukti transfer).
 */
const createFromBalance = asyncHandler(async (req, res) => {
  const requesterRole = String(req.user.role || '').toLowerCase();
  const isOwnerRequester = isOwnerRole(requesterRole);
  const isTeamRequester = ['admin_pusat', 'super_admin', 'role_accounting', 'invoice_koordinator', 'invoice_saudi'].includes(requesterRole);
  if (!isOwnerRequester && !isTeamRequester) {
    return res.status(403).json({ success: false, message: 'Akses ditolak untuk pengajuan penarikan saldo' });
  }
  const { amount: amountRaw, bank_name, account_number, account_holder_name, owner_id } = req.body || {};
  const targetOwnerId = isOwnerRequester ? req.user.id : String(owner_id || '').trim();
  if (!targetOwnerId) {
    return res.status(400).json({ success: false, message: 'owner_id wajib diisi untuk pengajuan oleh tim internal' });
  }
  const amount = parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'amount wajib angka positif' });
  const bank = bank_name ? String(bank_name).trim() : '';
  const account = account_number ? String(account_number).trim() : '';
  const holder = account_holder_name != null && String(account_holder_name).trim() !== '' ? String(account_holder_name).trim() : null;
  if (!bank || !account) return res.status(400).json({ success: false, message: 'bank_name dan account_number wajib diisi' });
  if (!holder) return res.status(400).json({ success: false, message: 'account_holder_name (nama pemilik rekening penerima) wajib diisi' });

  let createdRefund;
  try {
    await sequelize.transaction(async (tx) => {
      const profile = await OwnerProfile.findOne({
        where: { user_id: targetOwnerId },
        transaction: tx,
        lock: Transaction.LOCK.UPDATE
      });
      if (!profile) {
        const err = new Error('Profil owner tidak ditemukan');
        err.httpStatus = 404;
        throw err;
      }
      const balance = parseFloat(profile.balance) || 0;
      if (balance < amount) {
        const err = new Error(`Saldo tidak cukup. Saldo: Rp ${balance.toLocaleString('id-ID')}`);
        err.httpStatus = 400;
        throw err;
      }

      const r = await Refund.create(
        {
          invoice_id: null,
          order_id: null,
          owner_id: targetOwnerId,
          amount,
          status: REFUND_STATUS.REQUESTED,
          source: REFUND_SOURCE.BALANCE,
          bank_name: bank,
          account_number: account,
          account_holder_name: holder,
          reason: 'Penarikan saldo ke rekening',
          requested_by: req.user.id
        },
        { transaction: tx }
      );

      await profile.update({ balance: balance - amount }, { transaction: tx });
      await OwnerBalanceTransaction.create(
        {
          owner_id: targetOwnerId,
          amount: -amount,
          type: 'withdrawal_pending',
          reference_type: 'refund',
          reference_id: r.id,
          notes: `Pengajuan penarikan saldo — menunggu persetujuan Admin Pusat. Saldo -${amount.toLocaleString('id-ID')}`
        },
        { transaction: tx }
      );
      createdRefund = r;
    });
  } catch (e) {
    if (e.httpStatus) {
      return res.status(e.httpStatus).json({ success: false, message: e.message });
    }
    throw e;
  }

  await Notification.create({
    user_id: targetOwnerId,
    trigger: NOTIFICATION_TRIGGER.REFUND,
    title: 'Penarikan saldo diajukan',
    message: `Permintaan penarikan Rp ${amount.toLocaleString('id-ID')} diterima. Saldo akun langsung berkurang dan menunggu persetujuan Admin Pusat. Jika ditolak, saldo dikembalikan otomatis. Pantau status di menu Refund.`,
    data: { refund_id: createdRefund.id, status: 'requested', source: REFUND_SOURCE.BALANCE },
    channel_in_app: true,
    channel_email: false
  });

  const full = await Refund.findByPk(createdRefund.id, {
    include: [{ model: User, as: 'Owner', attributes: ['id', 'name'], required: false }]
  });
  res.status(201).json({
    success: true,
    data: full,
    message: isOwnerRequester
      ? 'Pengajuan terkirim. Saldo akun langsung berkurang dan menunggu persetujuan Admin Pusat.'
      : 'Pengajuan penarikan atas nama owner berhasil dibuat. Saldo owner langsung berkurang dan menunggu persetujuan Admin Pusat.'
  });
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
 * Penarikan saldo: saldo biasanya sudah dipotong saat pengajuan (withdrawal_pending); disetujui/refund = ubah jadi refund_debit. Ditolak = kembalikan saldo + riwayat.
 */
const updateStatus = asyncHandler(async (req, res) => {
  const allowed = ['admin_pusat', 'super_admin', 'role_accounting'].includes(req.user.role);
  if (!allowed) return res.status(403).json({ success: false, message: 'Hanya admin pusat dan accounting yang dapat memproses refund' });

  const r = await Refund.findByPk(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });

  const { status, rejection_reason } = req.body || {};
  const valid = [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED, REFUND_STATUS.REFUNDED].includes(status);
  if (!valid) return res.status(400).json({ success: false, message: 'status harus approved, rejected, atau refunded' });

  const prevStatus = r.status;
  const updates = { status };
  if (status === REFUND_STATUS.REJECTED && rejection_reason != null && String(rejection_reason).trim() !== '') {
    updates.rejection_reason = String(rejection_reason).trim();
  }
  if (status === REFUND_STATUS.APPROVED || status === REFUND_STATUS.REFUNDED) {
    updates.approved_by = req.user.id;
    updates.approved_at = new Date();
  }
  if (status === REFUND_STATUS.REFUNDED) updates.refunded_at = new Date();

  const rejectCtx = { restored: false };
  try {
    await sequelize.transaction(async (tx) => {
      await r.update(updates, { transaction: tx });

      if (r.invoice_id) {
        const inv = await Invoice.findByPk(r.invoice_id, { transaction: tx });
        if (inv) {
          if (status === REFUND_STATUS.APPROVED) {
            await logInvoiceStatusChange({
              invoice_id: inv.id,
              from_status: inv.status,
              to_status: inv.status,
              changed_by: req.user.id,
              reason: 'refund_approved',
              meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 },
              transaction: tx
            });
          } else if (status === REFUND_STATUS.REJECTED) {
            const fromStatus = inv.status;
            let toStatus = fromStatus;
            if (
              !isBalanceWithdrawalRefund(r) &&
              String(fromStatus || '').toLowerCase() === String(INVOICE_STATUS.CANCELLED_REFUND || '').toLowerCase()
            ) {
              toStatus = INVOICE_STATUS.REFUND_CANCELED;
              await inv.update({ status: INVOICE_STATUS.REFUND_CANCELED }, { transaction: tx });
            }
            await logInvoiceStatusChange({
              invoice_id: inv.id,
              from_status: fromStatus,
              to_status: toStatus,
              changed_by: req.user.id,
              reason: 'refund_rejected',
              meta: { refund_id: r.id, rejection_reason: updates.rejection_reason ?? null },
              transaction: tx
            });
          } else if (status === REFUND_STATUS.REFUNDED) {
            await logInvoiceStatusChange({
              invoice_id: inv.id,
              from_status: inv.status,
              to_status: INVOICE_STATUS.REFUNDED,
              changed_by: req.user.id,
              reason: 'refund_refunded',
              meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 },
              transaction: tx
            });
            await inv.update({ status: INVOICE_STATUS.REFUNDED }, { transaction: tx });
          }
        }
      }

      if (status === REFUND_STATUS.REJECTED && isBalanceWithdrawalRefund(r) && r.owner_id) {
        if (prevStatus !== REFUND_STATUS.REJECTED && [REFUND_STATUS.REQUESTED, REFUND_STATUS.APPROVED].includes(prevStatus)) {
          const rev = await reverseBalanceWithdrawalOnReject(r, {
            transaction: tx,
            rejectionReason: updates.rejection_reason ?? null
          });
          if (!rev.ok) {
            const err = new Error(rev.message);
            err.debitCode = rev.code;
            throw err;
          }
          if (rev.restored) rejectCtx.restored = true;
        }
      }

      if (status === REFUND_STATUS.REFUNDED && isBalanceWithdrawalRefund(r) && r.owner_id) {
        const debit = await applyBalanceRefundDebitIfNeeded(r, { transaction: tx });
        if (!debit.ok) {
          const err = new Error(debit.message);
          err.debitCode = debit.code;
          throw err;
        }
      }
    });
  } catch (e) {
    if (e.debitCode) return res.status(e.debitCode).json({ success: false, message: e.message });
    throw e;
  }

  if (r.owner_id) {
    const amtStr = Number(parseFloat(r.amount) || 0).toLocaleString('id-ID');
    if (status === REFUND_STATUS.APPROVED) {
      await Notification.create({
        user_id: r.owner_id,
        trigger: NOTIFICATION_TRIGGER.REFUND,
        title: isBalanceWithdrawalRefund(r) ? 'Penarikan saldo disetujui' : 'Refund disetujui',
        message:
          isBalanceWithdrawalRefund(r)
            ? `Permintaan penarikan saldo Rp ${amtStr} disetujui. Accounting akan mentransfer ke rekening yang Anda ajukan.`
            : `Permintaan refund Rp ${amtStr} disetujui.`,
        data: { refund_id: r.id, status: 'approved' },
        channel_in_app: true,
        channel_email: false
      });
    } else if (status === REFUND_STATUS.REJECTED) {
      const rejReason = updates.rejection_reason ? ` Alasan: ${updates.rejection_reason}` : '';
      const balanceRejMsg = rejectCtx.restored
        ? `Permintaan penarikan saldo Rp ${amtStr} ditolak. Saldo akun telah dikembalikan.${rejReason}`
        : `Permintaan penarikan saldo Rp ${amtStr} ditolak. Saldo tidak berubah.${rejReason}`;
      await Notification.create({
        user_id: r.owner_id,
        trigger: NOTIFICATION_TRIGGER.REFUND,
        title: isBalanceWithdrawalRefund(r) ? 'Penarikan saldo ditolak' : 'Refund ditolak',
        message:
          isBalanceWithdrawalRefund(r)
            ? balanceRejMsg
            : `Permintaan refund ditolak.${rejReason}`,
        data: { refund_id: r.id, status: 'rejected', rejection_reason: updates.rejection_reason ?? null },
        channel_in_app: true,
        channel_email: false
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
 * POST /api/v1/refunds/:id/complete-payout
 * Admin pusat/accounting: selesaikan transfer — wajib bank & nama rekening pengirim (BGG) + bukti. Status → refunded, owner dapat notifikasi & email lengkap.
 */
const completePayout = [
  refundProofUpload.single('proof_file'),
  asyncHandler(async (req, res) => {
    const allowed = ['admin_pusat', 'super_admin', 'role_accounting'].includes(req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: 'Hanya admin pusat dan accounting' });

    const r = await Refund.findByPk(req.params.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'], required: false },
        { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], required: false }
      ]
    });
    if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });
    if (r.status === REFUND_STATUS.REFUNDED && r.proof_file_url) {
      return res.status(409).json({ success: false, message: 'Permintaan ini sudah diselesaikan dan memiliki bukti.' });
    }
    if (![REFUND_STATUS.REQUESTED, REFUND_STATUS.APPROVED].includes(r.status)) {
      return res.status(400).json({
        success: false,
        message: 'Hanya status Menunggu atau Disetujui yang dapat diselesaikan dengan form transfer.'
      });
    }

    const payoutBank = req.body && req.body.payout_sender_bank_name ? String(req.body.payout_sender_bank_name).trim() : '';
    const payoutHolder = req.body && req.body.payout_sender_account_holder ? String(req.body.payout_sender_account_holder).trim() : '';
    const payoutAcctRaw = req.body && req.body.payout_sender_account_number != null ? String(req.body.payout_sender_account_number).trim() : '';
    const payoutAcct = payoutAcctRaw !== '' ? payoutAcctRaw : null;
    if (!payoutBank || !payoutHolder) {
      return res.status(400).json({ success: false, message: 'Bank pengirim dan nama pemilik rekening pengirim wajib diisi.' });
    }
    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'File bukti transfer wajib diunggah.' });
    }

    const parsedProofAt = parseTransferProofAt(req.body && req.body.transfer_proof_at);
    if (!parsedProofAt.ok) {
      return res.status(parsedProofAt.code).json({ success: false, message: parsedProofAt.message });
    }

    const finalName = uploadConfig.refundProofFilename(r.id, r.Invoice?.invoice_number, req.file.originalname);
    const oldPath = req.file.path;
    const newPath = path.join(refundProofDir, finalName);
    try {
      fs.renameSync(oldPath, newPath);
    } catch (e) {
      /* keep temp name */
    }
    const savedName = fs.existsSync(newPath) ? finalName : path.basename(oldPath);
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REFUND_PROOFS, savedName);

    const wasRefunded = r.status === REFUND_STATUS.REFUNDED;
    try {
      await sequelize.transaction(async (tx) => {
        await r.update(
          {
            proof_file_url: fileUrl,
            payout_sender_bank_name: payoutBank,
            payout_sender_account_holder: payoutHolder,
            payout_sender_account_number: payoutAcct,
            status: REFUND_STATUS.REFUNDED,
            proof_transfer_at: parsedProofAt.date,
            refunded_at: parsedProofAt.date,
            approved_by: req.user.id,
            approved_at: new Date()
          },
          { transaction: tx }
        );

        if (r.invoice_id) {
          const inv = await Invoice.findByPk(r.invoice_id, { transaction: tx });
          if (inv && !wasRefunded) {
            await logInvoiceStatusChange({
              invoice_id: inv.id,
              from_status: inv.status,
              to_status: INVOICE_STATUS.REFUNDED,
              changed_by: req.user.id,
              reason: 'refund_refunded',
              meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 },
              transaction: tx
            });
            await inv.update({ status: INVOICE_STATUS.REFUNDED }, { transaction: tx });
          }
        }

        if (!wasRefunded) {
          const debit = await applyBalanceRefundDebitIfNeeded(r, { transaction: tx });
          if (!debit.ok) {
            const err = new Error(debit.message);
            err.debitCode = debit.code;
            throw err;
          }
        }
      });
    } catch (e) {
      if (e.debitCode) return res.status(e.debitCode).json({ success: false, message: e.message });
      throw e;
    }

    const ownerEmail = r.Owner?.email || null;
    const proofPath = fs.existsSync(newPath) ? newPath : oldPath;
    const emailOpts = {
      balanceWithdrawal: isBalanceWithdrawalRefund(r),
      payout: { bankName: payoutBank, accountHolder: payoutHolder, accountNumber: payoutAcct || '' },
      recipient: {
        bankName: r.bank_name,
        accountNumber: r.account_number,
        accountHolder: r.account_holder_name
      }
    };
    let emailSent = false;
    if (ownerEmail) {
      emailSent = await sendRefundProofToOwner(
        ownerEmail,
        r.Owner?.name || 'Pemesan',
        parseFloat(r.amount) || 0,
        r.Invoice?.invoice_number || '',
        proofPath,
        emailOpts
      );
    }

    const amtStr = Number(parseFloat(r.amount) || 0).toLocaleString('id-ID');
    const isBal = isBalanceWithdrawalRefund(r);
    const inAppMsg = isBal
      ? `Transfer penarikan saldo Rp ${amtStr} selesai. Pengirim: ${payoutBank}, a.n. ${payoutHolder}${payoutAcct ? `, No. ${payoutAcct}` : ''}. Penerima Anda: ${r.bank_name || '-'} · ${r.account_number || '-'} a.n. ${r.account_holder_name || '-'}. Bukti: menu Refund${ownerEmail ? ' & email Anda' : ''}.`
      : `Refund Rp ${amtStr} selesai. Transfer dari ${payoutBank} a.n. ${payoutHolder}. Penerima: ${r.bank_name || '-'} · ${r.account_number || '-'}. Bukti di menu Refund${ownerEmail ? ' & email' : ''}.`;

    if (r.owner_id) {
      await Notification.create({
        user_id: r.owner_id,
        trigger: NOTIFICATION_TRIGGER.REFUND,
        title: isBal ? 'Penarikan saldo — transfer selesai' : 'Refund — transfer selesai',
        message: inAppMsg,
        data: {
          refund_id: r.id,
          invoice_id: r.invoice_id,
          proof_file_url: fileUrl,
          source: r.source,
          payout_sender_bank_name: payoutBank,
          payout_sender_account_holder: payoutHolder,
          payout_sender_account_number: payoutAcct
        },
        channel_in_app: true,
        channel_email: true,
        ...(emailSent ? { email_sent_at: new Date() } : {})
      });
    }

    const updated = await Refund.findByPk(r.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'], required: false },
        { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], required: false }
      ]
    });
    res.json({
      success: true,
      data: updated,
      message:
        'Transfer selesai. Owner menerima notifikasi lengkap' + (ownerEmail ? ' dan email berisi bukti.' : ' di aplikasi.')
    });
  })
];

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

    const parsedProofAt = parseTransferProofAt(req.body && req.body.transfer_proof_at);
    if (!parsedProofAt.ok) {
      return res.status(parsedProofAt.code).json({ success: false, message: parsedProofAt.message });
    }

    const finalName = uploadConfig.refundProofFilename(r.id, r.Invoice?.invoice_number, req.file.originalname);
    const oldPath = req.file.path;
    const newPath = path.join(refundProofDir, finalName);
    try { fs.renameSync(oldPath, newPath); } catch (e) { /* keep temp name */ }
    const savedName = fs.existsSync(newPath) ? finalName : path.basename(oldPath);
    const fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REFUND_PROOFS, savedName);

    const wasRefunded = r.status === REFUND_STATUS.REFUNDED;
    try {
      await sequelize.transaction(async (tx) => {
        await r.update(
          {
            proof_file_url: fileUrl,
            proof_transfer_at: parsedProofAt.date,
            ...(wasRefunded
              ? {}
              : {
                  status: REFUND_STATUS.REFUNDED,
                  refunded_at: parsedProofAt.date,
                  approved_by: req.user.id,
                  approved_at: new Date()
                })
          },
          { transaction: tx }
        );

        if (r.invoice_id) {
          const inv = await Invoice.findByPk(r.invoice_id, { transaction: tx });
          if (inv && !wasRefunded) {
            await logInvoiceStatusChange({
              invoice_id: inv.id,
              from_status: inv.status,
              to_status: INVOICE_STATUS.REFUNDED,
              changed_by: req.user.id,
              reason: 'refund_refunded',
              meta: { refund_id: r.id, amount: parseFloat(r.amount) || 0 },
              transaction: tx
            });
            await inv.update({ status: INVOICE_STATUS.REFUNDED }, { transaction: tx });
          }
        }

        if (!wasRefunded) {
          const debit = await applyBalanceRefundDebitIfNeeded(r, { transaction: tx });
          if (!debit.ok) {
            const err = new Error(debit.message);
            err.debitCode = debit.code;
            throw err;
          }
        }
      });
    } catch (e) {
      if (e.debitCode) return res.status(e.debitCode).json({ success: false, message: e.message });
      throw e;
    }

    const refreshed = await Refund.findByPk(r.id);
    const ownerEmail = r.Owner?.email || null;
    const proofPath = fs.existsSync(newPath) ? newPath : oldPath;
    const emailOpts = {
      balanceWithdrawal: isBalanceWithdrawalRefund(refreshed || r),
      payout: {
        bankName: refreshed?.payout_sender_bank_name || '',
        accountHolder: refreshed?.payout_sender_account_holder || '',
        accountNumber: refreshed?.payout_sender_account_number || ''
      },
      recipient: {
        bankName: refreshed?.bank_name || r.bank_name,
        accountNumber: refreshed?.account_number || r.account_number,
        accountHolder: refreshed?.account_holder_name || r.account_holder_name
      }
    };
    let emailSent = false;
    if (ownerEmail) {
      emailSent = await sendRefundProofToOwner(
        ownerEmail,
        r.Owner?.name || 'Pemesan',
        parseFloat(r.amount) || 0,
        r.Invoice?.invoice_number || '',
        proofPath,
        emailOpts
      );
    }
    const isBalance = isBalanceWithdrawalRefund(r);
    const notifTitle = isBalance ? 'Penarikan saldo selesai' : 'Refund diproses – bukti terkirim';
    const notifMsg = isBalance
      ? `Penarikan saldo Rp ${Number(parseFloat(r.amount) || 0).toLocaleString('id-ID')} — transfer selesai. Bukti${ownerEmail ? ' dikirim ke email Anda' : ' tersedia di menu Refund'}. (Saldo dipotong saat pengajuan.)`
      : `Refund untuk invoice ${r.Invoice?.invoice_number || ''} telah diproses. Bukti transfer telah dikirim ke email Anda.`;
    await Notification.create({
      user_id: r.owner_id,
      trigger: NOTIFICATION_TRIGGER.REFUND,
      title: notifTitle,
      message: notifMsg,
      data: { refund_id: r.id, invoice_id: r.invoice_id, proof_file_url: fileUrl, source: r.source },
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

/**
 * POST /api/v1/refunds/:id/sync-balance-debit
 * Admin/accounting: potong saldo owner untuk penarikan saldo jika belum tercatat (mis. server lama atau gagal diam-diam).
 * Idempoten — aman dipanggil berulang.
 */
const syncBalanceDebit = asyncHandler(async (req, res) => {
  const allowed = ['admin_pusat', 'super_admin', 'role_accounting'].includes(req.user.role);
  if (!allowed) return res.status(403).json({ success: false, message: 'Hanya admin pusat dan accounting' });

  const r = await Refund.findByPk(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: 'Refund tidak ditemukan' });
  if (!isBalanceWithdrawalRefund(r)) {
    return res.status(400).json({ success: false, message: 'Hanya untuk penarikan saldo (bukan refund invoice).' });
  }
  if (r.status !== REFUND_STATUS.REFUNDED) {
    return res.status(400).json({
      success: false,
      message: 'Saldo hanya dapat dipotong setelah transfer selesai (status Sudah direfund).'
    });
  }

  try {
    await sequelize.transaction(async (tx) => {
      const debit = await applyBalanceRefundDebitIfNeeded(r, { transaction: tx });
      if (!debit.ok) {
        const err = new Error(debit.message);
        err.debitCode = debit.code;
        throw err;
      }
    });
  } catch (e) {
    if (e.debitCode) return res.status(e.debitCode).json({ success: false, message: e.message });
    throw e;
  }

  const profile = await OwnerProfile.findOne({ where: { user_id: r.owner_id } });
  const bal = profile ? parseFloat(profile.balance) || 0 : null;
  res.json({
    success: true,
    message: 'Saldo owner disinkronkan. Jika sebelumnya belum terpotong, sudah dipotong sekarang (cek riwayat saldo).',
    data: { owner_balance: bal }
  });
});

module.exports = { getStats, list, getById, updateStatus, createFromBalance, completePayout, uploadProof, getProofFile, syncBalanceDebit };
