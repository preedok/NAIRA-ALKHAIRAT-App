/**
 * Layanan email (nodemailer). Kirim MOU ke travel setelah aktivasi.
 */
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const emailConfig = require('../config/email');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!emailConfig.enabled) return null;
  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.user && emailConfig.password
      ? { user: emailConfig.user, pass: emailConfig.password }
      : undefined
  });
  return transporter;
}

/**
 * Kirim email ke travel berisi: surat MOU (lampiran), email travel, password baru.
 * Pengirim: Admin Pusat (EMAIL_FROM_NAME).
 * @param {string} toEmail - Email travel
 * @param {string} travelName - Nama travel
 * @param {string} newPassword - Password yang digenerate sistem
 * @param {string} mouFilePath - Path absolut ke file PDF MOU
 * @returns {Promise<boolean>} - true jika terkirim
 */
async function sendMouToTravel(toEmail, travelName, newPassword, mouFilePath) {
  if (!emailConfig.from && !emailConfig.user) {
    logger.warn('Email tidak dikonfigurasi: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (dan EMAIL_FROM opsional) di .env. MOU tidak dikirim ke ' + toEmail);
    return false;
  }
  const trans = getTransporter();
  if (!trans) {
    logger.warn('Email tidak dikonfigurasi (SMTP). Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD di .env agar MOU terkirim ke travel. Target: ' + toEmail);
    return false;
  }
  const mouFilename = path.basename(mouFilePath);
  const attachments = [];
  if (mouFilePath && fs.existsSync(mouFilePath)) {
    attachments.push({
      filename: mouFilename,
      content: fs.createReadStream(mouFilePath)
    });
  } else {
    logger.warn('File MOU tidak ditemukan (email tetap dikirim tanpa lampiran): ' + mouFilePath);
  }

  const subject = 'Aktivasi Akun Partner – Surat MoU & Password Baru | Bintang Global Group';
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} .label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;} .value{font-size:16px;font-weight:600;color:#0f172a;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>Aktivasi Akun Partner</h1>
  <p>Halo <strong>${(travelName || '').replace(/</g, '&lt;')}</strong>,</p>
  <p>Akun partner Anda telah diaktivasi oleh Admin Pusat. Berikut data login Anda (simpan dengan aman):</p>
  <div class="box">
    <p class="label">Email login</p>
    <p class="value">${(toEmail || '').replace(/</g, '&lt;')}</p>
  </div>
  <div class="box">
    <p class="label">Password baru (dibuat sistem)</p>
    <p class="value">${(newPassword || '').replace(/</g, '&lt;')}</p>
  </div>
  <p>Password yang Anda buat saat pendaftaran tidak lagi berlaku. Gunakan password di atas untuk login.</p>
  <p>Surat MoU resmi terlampir dalam email ini. Silakan unduh dan simpan. Anda juga dapat melihat dan mengunduh surat MoU kapan saja di aplikasi: masuk ke dashboard lalu menu <strong>MoU Saya</strong>.</p>
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group. Pengirim: ${(emailConfig.fromName || 'Admin Pusat').replace(/</g, '&lt;')}.</p>
</body>
</html>`;

  const text = `Aktivasi Akun Partner\n\nHalo ${travelName},\n\nAkun Anda telah diaktivasi.\n\nEmail login: ${toEmail}\nPassword baru: ${newPassword}\n\nPassword lama tidak berlaku. Surat MoU terlampir.\n\n— ${emailConfig.fromName}`;

  const fromAddr = emailConfig.from || emailConfig.user;
  if (!fromAddr) {
    logger.warn('EMAIL_FROM atau SMTP_USER wajib untuk pengirim. MOU tidak dikirim ke ' + toEmail);
    return false;
  }
  try {
    await trans.sendMail({
      from: `"${(emailConfig.fromName || 'Bintang Global').replace(/"/g, '')}" <${fromAddr}>`,
      to: toEmail,
      subject,
      text,
      html,
      attachments
    });
    logger.info('Email MOU terkirim ke ' + toEmail);
    return true;
  } catch (err) {
    logger.error('Gagal kirim email MOU ke ' + toEmail + ': ' + (err.message || String(err)));
    return false;
  }
}

/**
 * Kirim email ke pemesan (owner) berisi bukti refund. Dipanggil setelah accounting upload bukti refund.
 * @param {string} toEmail - Email pemesan
 * @param {string} ownerName - Nama pemesan
 * @param {number} amount - Jumlah refund (IDR)
 * @param {string} invoiceNumber - Nomor invoice
 * @param {string} proofFilePath - Path absolut ke file bukti refund (lampiran)
 * @returns {Promise<boolean>}
 */
async function sendRefundProofToOwner(toEmail, ownerName, amount, invoiceNumber, proofFilePath, opts = {}) {
  const isBalanceWithdrawal = opts && opts.balanceWithdrawal === true;
  const payout = opts.payout || {};
  const recipient = opts.recipient || {};
  const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!toEmail || !toEmail.trim()) {
    logger.warn('Email pemesan kosong, bukti refund tidak dikirim');
    return false;
  }
  if (!emailConfig.from && !emailConfig.user) {
    logger.warn('Email tidak dikonfigurasi. Bukti refund tidak dikirim ke ' + toEmail);
    return false;
  }
  const trans = getTransporter();
  if (!trans) {
    logger.warn('SMTP tidak dikonfigurasi. Bukti refund tidak dikirim ke ' + toEmail);
    return false;
  }
  const amountStr = Number(amount).toLocaleString('id-ID');
  const attachments = [];
  if (proofFilePath && require('fs').existsSync(proofFilePath)) {
    attachments.push({
      filename: require('path').basename(proofFilePath),
      content: require('fs').createReadStream(proofFilePath)
    });
  }
  const subject = isBalanceWithdrawal
    ? `Bukti penarikan saldo akun | Bintang Global Group`
    : `Bukti Refund – Invoice ${invoiceNumber || ''} | Bintang Global Group`;
  const introHtml = isBalanceWithdrawal
    ? `<p>Penarikan saldo akun Anda sebesar <strong>Rp ${amountStr}</strong> telah diproses.</p><p>Untuk penarikan saldo, nominal sudah dipotong dari saldo akun saat Anda mengajukan; email ini melengkapi data transfer ke rekening Anda.</p>`
    : `<p>Refund untuk invoice <strong>${esc(invoiceNumber)}</strong> telah diproses oleh tim accounting.</p>`;
  const introText = isBalanceWithdrawal
    ? `Penarikan saldo sebesar Rp ${amountStr}. Saldo akun telah dipotong saat pengajuan; berikut detail transfer ke rekening Anda.`
    : `Refund untuk invoice ${invoiceNumber || '-'} telah diproses.`;
  const payoutBank = esc(payout.bankName);
  const payoutHolder = esc(payout.accountHolder);
  const payoutAcct = esc(payout.accountNumber);
  const payoutBlock =
    payoutBank || payoutHolder
      ? `<div class="box"><p class="label">Rekening pengirim (Bintang Global Group)</p><p class="value">${payoutBank || '—'}</p>${payoutHolder ? `<p style="margin:8px 0 0;font-size:14px;color:#475569;">a.n. <strong>${payoutHolder}</strong>${payoutAcct ? `<br/>No. rekening: ${payoutAcct}` : ''}</p>` : ''}</div>`
      : '';
  const payoutTextBlock =
    payoutBank || payoutHolder
      ? `\nRekening pengirim (BGG): ${payout.bankName || ''}${payoutHolder ? ` a.n. ${payout.accountHolder}` : ''}${payout.accountNumber ? ` No. ${payout.accountNumber}` : ''}\n`
      : '';
  const recvBank = esc(recipient.bankName);
  const recvNum = esc(recipient.accountNumber);
  const recvHolder = esc(recipient.accountHolder);
  const recvBlock =
    recvBank || recvNum
      ? `<div class="box"><p class="label">Rekening penerima (Anda)</p><p class="value">${recvBank || '—'} ${recvNum ? `· ${recvNum}` : ''}</p>${recvHolder ? `<p style="margin:8px 0 0;font-size:14px;color:#475569;">a.n. <strong>${recvHolder}</strong></p>` : ''}</div>`
      : `<p>Dana dialihkan ke rekening yang Anda ajukan di aplikasi.</p>`;
  const recvText =
    recvBank || recvNum
      ? `Rekening penerima: ${recipient.bankName || ''} ${recipient.accountNumber || ''} a.n. ${recipient.accountHolder || ''}`
      : 'Dana ke rekening yang Anda ajukan.';
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} .label{font-size:12px;color:#64748b;} .value{font-size:16px;font-weight:600;color:#0f172a;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>${isBalanceWithdrawal ? 'Penarikan saldo selesai' : 'Proses Refund Selesai'}</h1>
  <p>Halo <strong>${esc(ownerName || 'Pemesan')}</strong>,</p>
  ${introHtml}
  <div class="box">
    <p class="label">${isBalanceWithdrawal ? 'Jumlah transfer' : 'Jumlah yang direfund'}</p>
    <p class="value">Rp ${amountStr}</p>
  </div>
  ${payoutBlock}
  ${recvBlock}
  <p>Bukti transfer terlampir dalam email ini.</p>
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group.</p>
</body>
</html>`;
  const text = `${isBalanceWithdrawal ? 'Penarikan saldo selesai' : 'Proses Refund Selesai'}\n\nHalo ${ownerName || 'Pemesan'},\n\n${introText}\n\nJumlah: Rp ${amountStr}.${payoutTextBlock}\n${recvText}\n\nBukti transfer terlampir.\n\n— Bintang Global Group`;
  const fromAddr = emailConfig.from || emailConfig.user;
  if (!fromAddr) return false;
  try {
    await trans.sendMail({
      from: `"${(emailConfig.fromName || 'Bintang Global').replace(/"/g, '')}" <${fromAddr}>`,
      to: toEmail.trim(),
      subject,
      text,
      html,
      attachments
    });
    logger.info('Email bukti refund terkirim ke ' + toEmail);
    return true;
  } catch (err) {
    logger.error('Gagal kirim email bukti refund ke ' + toEmail + ': ' + (err.message || String(err)));
    return false;
  }
}

/**
 * Kirim email notifikasi transaksi: invoice baru (lampiran: PDF invoice).
 * @param {string} toEmail
 * @param {string} ownerName
 * @param {string} invoiceNumber
 * @param {string} orderNumber
 * @param {Buffer} invoicePdfBuffer - PDF invoice (lampiran)
 * @param {string} [dueInfo] - Contoh: "Silakan bayar DP dalam 24 jam."
 */
async function sendInvoiceCreatedEmail(toEmail, ownerName, invoiceNumber, orderNumber, invoicePdfBuffer, dueInfo = '') {
  if (!toEmail || !toEmail.trim()) return false;
  if (!emailConfig.from && !emailConfig.user) return false;
  const trans = getTransporter();
  if (!trans) return false;
  const attachments = [];
  if (Buffer.isBuffer(invoicePdfBuffer) && invoicePdfBuffer.length > 0) {
    attachments.push({ filename: `invoice-${(invoiceNumber || 'inv').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, content: invoicePdfBuffer });
  }
  const subject = `Invoice ${invoiceNumber || ''} – Order ${orderNumber || ''} | Bintang Global Group`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} .label{font-size:12px;color:#64748b;} .value{font-size:16px;font-weight:600;color:#0f172a;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>Invoice Baru</h1>
  <p>Halo <strong>${escapeHtml(ownerName || 'Pemesan')}</strong>,</p>
  <p>Invoice <strong>${escapeHtml(invoiceNumber || '')}</strong> untuk order <strong>${escapeHtml(orderNumber || '')}</strong> telah dibuat.</p>
  <div class="box"><p class="label">Lampiran</p><p class="value">Invoice PDF terlampir.</p></div>
  ${dueInfo ? `<p>${escapeHtml(dueInfo)}</p>` : ''}
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group.</p>
</body>
</html>`;
  const text = `Invoice Baru\n\nHalo ${ownerName || 'Pemesan'},\n\nInvoice ${invoiceNumber || ''} untuk order ${orderNumber || ''} telah dibuat. Invoice PDF terlampir.\n${dueInfo ? dueInfo + '\n' : ''}\n— Bintang Global Group`;
  return sendMail(toEmail, subject, text, html, attachments);
}

/**
 * Kirim email notifikasi: DP diterima / Invoice lunas (lampiran: bukti bayar + opsional invoice PDF).
 */
async function sendPaymentReceivedEmail(toEmail, ownerName, invoiceNumber, amount, isLunas, paymentProofPath, invoicePdfBuffer) {
  if (!toEmail || !toEmail.trim()) return false;
  if (!emailConfig.from && !emailConfig.user) return false;
  const trans = getTransporter();
  if (!trans) return false;
  const attachments = [];
  if (paymentProofPath && fs.existsSync(paymentProofPath)) {
    attachments.push({ filename: path.basename(paymentProofPath), content: fs.createReadStream(paymentProofPath) });
  }
  if (Buffer.isBuffer(invoicePdfBuffer) && invoicePdfBuffer.length > 0) {
    attachments.push({ filename: `invoice-${(invoiceNumber || 'inv').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, content: invoicePdfBuffer });
  }
  const amountStr = Number(amount || 0).toLocaleString('id-ID');
  const title = isLunas ? 'Invoice Lunas' : 'DP Diterima';
  const subject = `${title} – Invoice ${invoiceNumber || ''} | Bintang Global Group`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} .label{font-size:12px;color:#64748b;} .value{font-size:16px;font-weight:600;color:#0f172a;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>${title}</h1>
  <p>Halo <strong>${escapeHtml(ownerName || 'Pemesan')}</strong>,</p>
  <p>Pembayaran untuk invoice <strong>${escapeHtml(invoiceNumber || '')}</strong> telah dicatat dan diverifikasi.</p>
  <div class="box"><p class="label">Jumlah</p><p class="value">Rp ${amountStr}</p></div>
  <p>${attachments.length ? 'Bukti pembayaran dan invoice PDF terlampir.' : 'Detail dapat dilihat di aplikasi.'}</p>
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group.</p>
</body>
</html>`;
  const text = `${title}\n\nHalo ${ownerName || 'Pemesan'},\n\nPembayaran untuk invoice ${invoiceNumber || ''} telah diverifikasi. Jumlah: Rp ${amountStr}.\n\n— Bintang Global Group`;
  return sendMail(toEmail, subject, text, html, attachments);
}

/**
 * Kirim email notifikasi: trip selesai / hasil order.
 */
async function sendOrderResultEmail(toEmail, ownerName, invoiceNumber, message) {
  if (!toEmail || !toEmail.trim()) return false;
  if (!emailConfig.from && !emailConfig.user) return false;
  const trans = getTransporter();
  if (!trans) return false;
  const subject = `Trip Selesai – Invoice ${invoiceNumber || ''} | Bintang Global Group`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>Trip Selesai</h1>
  <p>Halo <strong>${escapeHtml(ownerName || 'Pemesan')}</strong>,</p>
  <p>${escapeHtml(message || `Invoice ${invoiceNumber || ''} telah selesai. Hasil dapat diunduh/dilihat di aplikasi.`)}</p>
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group.</p>
</body>
</html>`;
  const text = `Trip Selesai\n\nHalo ${ownerName || 'Pemesan'},\n\n${message || `Invoice ${invoiceNumber || ''} telah selesai.`}\n\n— Bintang Global Group`;
  return sendMail(toEmail, subject, text, html, []);
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendMail(toEmail, subject, text, html, attachments) {
  const fromAddr = emailConfig.from || emailConfig.user;
  if (!fromAddr) return false;
  try {
    const trans = getTransporter();
    await trans.sendMail({
      from: `"${(emailConfig.fromName || 'Bintang Global').replace(/"/g, '')}" <${fromAddr}>`,
      to: toEmail.trim(),
      subject,
      text,
      html,
      attachments: attachments || []
    });
    logger.info('Email notifikasi terkirim ke ' + toEmail);
    return true;
  } catch (err) {
    logger.error('Gagal kirim email notifikasi ke ' + toEmail + ': ' + (err.message || String(err)));
    return false;
  }
}

/** Alias for owner terminology */
const sendMouToOwner = sendMouToTravel;
module.exports = {
  sendMouToTravel,
  sendMouToOwner,
  getTransporter,
  sendRefundProofToOwner,
  sendInvoiceCreatedEmail,
  sendPaymentReceivedEmail,
  sendOrderResultEmail
};
