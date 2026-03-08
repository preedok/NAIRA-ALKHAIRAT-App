const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PaymentProof, Invoice, Order, Notification, Bank, AccountingBankAccount } = require('../models');
const { ROLES } = require('../constants');
const { INVOICE_STATUS, NOTIFICATION_TRIGGER, DP_PAYMENT_STATUS } = require('../constants');
const { sendPaymentReceivedNotificationEmail } = require('./invoiceController');
const { getRulesForBranch } = require('./businessRuleController');
const uploadConfig = require('../config/uploads');

const proofDir = uploadConfig.getDir(uploadConfig.SUBDIRS.PAYMENT_PROOFS);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename, safeExt } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const ext = safeExt(file.originalname);
    cb(null, `BUKTI_${req.params.id}_${date}_${time}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /api/v1/invoices/:id/payment-proofs
 * Owner upload bukti bayar. Or role invoice (Saudi) issue bukti: body only, no file (payment_location: saudi).
 */
const create = [
  upload.single('proof_file'),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    if (invoice.owner_id !== req.user.id && !['invoice_koordinator', 'invoice_saudi', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const { payment_type, amount, bank_id, bank_name, account_number, transfer_date, notes, payment_currency, sender_account_name, sender_account_number, recipient_bank_account_id } = req.body;
    const payment_location = (req.body.payment_location != null ? String(req.body.payment_location) : '').trim().toLowerCase();
    let amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ success: false, message: 'amount wajib dan harus > 0' });
    const type = ['dp', 'partial', 'full'].includes(payment_type) ? payment_type : 'dp';

    const isIssueByInvoice = req.user.role === ROLES.ROLE_INVOICE_SAUDI && payment_location === 'saudi';
    let paymentCurrency = (payment_currency || 'IDR').toUpperCase();
    if (paymentCurrency !== 'SAR' && paymentCurrency !== 'USD') paymentCurrency = 'IDR';
    let amountOriginal = null;
    if (isIssueByInvoice && (paymentCurrency === 'SAR' || paymentCurrency === 'USD')) {
      const rules = await getRulesForBranch(invoice.branch_id);
      const cr = rules.currency_rates || {};
      const SAR_TO_IDR = (cr && typeof cr.SAR_TO_IDR === 'number') ? cr.SAR_TO_IDR : 4200;
      const USD_TO_IDR = (cr && typeof cr.USD_TO_IDR === 'number') ? cr.USD_TO_IDR : 15500;
      amountOriginal = amt;
      amt = paymentCurrency === 'SAR' ? amt * SAR_TO_IDR : amt * USD_TO_IDR;
      amt = Math.round(amt);
    }
    // IDR: jumlah sesuai mata uang, tidak perlu konversi

    let fileUrl = null;
    let proofFileName = null;
    let proofFileContentType = null;
    let proofFileData = null;
    if (req.file) {
      const finalName = uploadConfig.paymentProofFilename(invoice.invoice_number, type, amt, req.file.originalname);
      const oldPath = req.file.path;
      const newPath = path.join(proofDir, finalName);
      let savedName = req.file.filename;
      try {
        fs.renameSync(oldPath, newPath);
        savedName = finalName;
      } catch (e) {
        // jika rename gagal (misal cross-device), pakai nama file sementara
      }
      fileUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.PAYMENT_PROOFS, savedName);
      proofFileName = (req.file.originalname || savedName || 'bukti').replace(/[^\w\s.-]/gi, '_').slice(0, 255);
      proofFileContentType = req.file.mimetype || MIME_BY_EXT[path.extname(savedName).toLowerCase()] || 'application/octet-stream';
      try {
        proofFileData = fs.readFileSync(newPath);
      } catch (e) {
        // simpan ke DB opsional; jika gagal baca tetap simpan path
      }
    }
    if (!fileUrl) return res.status(400).json({ success: false, message: 'Upload bukti bayar wajib.' });

    let resolvedBankName = (bank_name && String(bank_name).trim()) || null;
    let resolvedBankId = null;
    if (bank_id) {
      const bank = await Bank.findByPk(bank_id);
      if (bank) {
        resolvedBankId = bank.id;
        resolvedBankName = bank.name;
      }
    }

    let recipientBankAccountId = (recipient_bank_account_id && String(recipient_bank_account_id).trim()) || null;
    if (recipientBankAccountId) {
      const acc = await AccountingBankAccount.findByPk(recipientBankAccountId);
      if (!acc) recipientBankAccountId = null;
    }

    const proof = await PaymentProof.create({
      invoice_id: invoice.id,
      payment_type: type,
      amount: amt,
      amount_idr: amt,
      amount_sar: paymentCurrency === 'SAR' && amountOriginal != null ? amountOriginal : null,
      payment_currency: paymentCurrency,
      amount_original: amountOriginal,
      bank_id: resolvedBankId,
      bank_name: resolvedBankName,
      account_number: account_number || null,
      sender_account_name: (sender_account_name && String(sender_account_name).trim()) || null,
      sender_account_number: (sender_account_number && String(sender_account_number).trim()) || null,
      recipient_bank_account_id: recipientBankAccountId,
      transfer_date: transfer_date || null,
      proof_file_url: fileUrl,
      proof_file_name: proofFileName,
      proof_file_content_type: proofFileContentType,
      proof_file_data: proofFileData,
      uploaded_by: isIssueByInvoice ? null : req.user.id,
      issued_by: isIssueByInvoice ? req.user.id : null,
      payment_location: payment_location === 'saudi' ? 'saudi' : 'indonesia',
      notes
    });

    // Auto-verify pembayaran Saudi (SAR/USD/IDR): invoice dan order otomatis update. Hitung paid_amount dari jumlah SEMUA bukti terverifikasi di DB.
    if (isIssueByInvoice) {
      await proof.update({ verified_by: req.user.id, verified_at: new Date(), verified_status: 'verified' });
      const allProofs = await PaymentProof.findAll({ where: { invoice_id: invoice.id } });
      const verifiedSum = allProofs
        .filter(p => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at != null && p.verified_status !== 'rejected'))
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const inv = await Invoice.findByPk(invoice.id);
      const totalInv = parseFloat(inv.total_amount) || 0;
      const remaining = Math.max(0, totalInv - verifiedSum);
      let newStatus = inv.status;
      if (remaining <= 0) newStatus = INVOICE_STATUS.PAID;
      else if ((parseFloat(inv.dp_amount) || 0) > 0 && verifiedSum >= parseFloat(inv.dp_amount)) newStatus = INVOICE_STATUS.PARTIAL_PAID;
      await inv.update({ paid_amount: verifiedSum, remaining_amount: remaining, status: newStatus });
      const order = await Order.findByPk(inv.order_id);
      if (order) {
        const total = parseFloat(inv.total_amount) || 0;
        const dpAmount = parseFloat(inv.dp_amount) || 0;
        const pct = total > 0 ? Math.round((verifiedSum / total) * 10000) / 100 : null;
        const hasDpPaid = dpAmount > 0 && verifiedSum >= dpAmount;
        await order.update({
          dp_payment_status: hasDpPaid ? DP_PAYMENT_STATUS.PEMBAYARAN_DP : DP_PAYMENT_STATUS.TAGIHAN_DP,
          dp_percentage_paid: pct,
          ...(newStatus === INVOICE_STATUS.PAID && !['completed', 'cancelled'].includes(order.status) ? { status: 'processing' } : {})
        });
      }
      const notif = await Notification.create({
        user_id: inv.owner_id,
        trigger: newStatus === INVOICE_STATUS.PAID ? NOTIFICATION_TRIGGER.LUNAS : NOTIFICATION_TRIGGER.DP_RECEIVED,
        title: newStatus === INVOICE_STATUS.PAID ? 'Invoice lunas' : 'DP diterima',
        message: `Pembayaran untuk ${inv.invoice_number} telah dicatat (Saudi) dan diverifikasi.`,
        data: { invoice_id: inv.id, payment_proof_id: proof.id },
        channel_in_app: true,
        channel_email: true
      });
      setImmediate(() => sendPaymentReceivedNotificationEmail(inv.id, notif.id, proof.id, newStatus === INVOICE_STATUS.PAID));
    }

    const full = await PaymentProof.findByPk(proof.id);
    const out = { success: true, data: full };
    if (isIssueByInvoice) {
      const updatedInv = await Invoice.findByPk(invoice.id, { include: [{ model: Order, as: 'Order', attributes: ['id', 'order_number', 'total_amount', 'currency', 'status'] }, { model: PaymentProof, as: 'PaymentProofs' }] });
      if (updatedInv) out.invoice = updatedInv;
    }
    res.status(201).json(out);
  })
];

/**
 * GET /api/v1/invoices/:id/payment-proofs/:proofId/file
 * Stream file bukti bayar (untuk preview di popup; auth dipakai sehingga img/fetch bisa akses).
 */
const getFile = asyncHandler(async (req, res) => {
  const proof = await PaymentProof.findOne({
    where: { id: req.params.proofId, invoice_id: req.params.id },
    attributes: ['id', 'invoice_id', 'proof_file_url', 'proof_file_name', 'proof_file_content_type', 'proof_file_data']
  });
  if (!proof || !proof.proof_file_url || proof.proof_file_url === 'issued-saudi') {
    return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  }
  const invoice = await Invoice.findByPk(proof.invoice_id, { attributes: ['owner_id'] });
  const allowedRoles = [
    'super_admin', 'admin_pusat', 'invoice_koordinator', 'invoice_saudi', 'role_accounting',
    'role_hotel', 'role_bus', 'handling', 'tiket_koordinator', 'visa_koordinator'
  ];
  const canAccess = invoice && (
    invoice.owner_id === req.user.id ||
    (req.user.role && allowedRoles.includes(req.user.role))
  );
  if (!canAccess) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  // Prioritas 1: kirim dari DB jika ada (file disimpan di database)
  const data = proof.proof_file_data;
  if (data && (Buffer.isBuffer(data) || data instanceof Uint8Array)) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const mime = proof.proof_file_content_type || 'application/octet-stream';
    const name = proof.proof_file_name || 'bukti-bayar';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${name.replace(/"/g, '%22')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(buf);
  }

  // Prioritas 2: stream dari disk
  const urlNorm = (proof.proof_file_url || '').replace(/\\/g, '/').trim();
  const match = urlNorm.match(/payment-proofs\/?(.+)$/i);
  const filename = match ? match[1].replace(/^\/+/, '').split('/').pop() : null;
  if (!filename) return res.status(404).json({ success: false, message: 'Path tidak valid' });
  const filePath = path.join(proofDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada di server' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = { create, upload, getFile };