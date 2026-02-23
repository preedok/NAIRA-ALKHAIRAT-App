/**
 * Layanan email (nodemailer). Kirim MOU ke owner setelah aktivasi.
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
 * Kirim email ke owner berisi: surat MOU (lampiran), email owner, password baru.
 * Pengirim: Admin Pusat (EMAIL_FROM_NAME).
 * @param {string} toEmail - Email owner
 * @param {string} ownerName - Nama owner
 * @param {string} newPassword - Password yang digenerate sistem
 * @param {string} mouFilePath - Path absolut ke file PDF MOU
 * @returns {Promise<boolean>} - true jika terkirim
 */
async function sendMouToOwner(toEmail, ownerName, newPassword, mouFilePath) {
  const trans = getTransporter();
  if (!trans) {
    logger.warn('Email tidak dikonfigurasi (SMTP). MOU tidak dikirim ke ' + toEmail);
    return false;
  }
  const mouFilename = path.basename(mouFilePath);
  const attachments = [];
  if (fs.existsSync(mouFilePath)) {
    attachments.push({
      filename: mouFilename,
      content: fs.createReadStream(mouFilePath)
    });
  } else {
    logger.warn('File MOU tidak ditemukan: ' + mouFilePath);
  }

  const subject = 'Aktivasi Akun Partner – Surat MoU & Password Baru | Bintang Global Group';
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;line-height:1.6;color:#334155;max-width:560px;margin:0 auto;padding:24px;} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;} .label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;} .value{font-size:16px;font-weight:600;color:#0f172a;} h1{font-size:20px;color:#0f172a;} p{color:#475569;} .footer{font-size:12px;color:#94a3b8;margin-top:24px;}</style></head>
<body>
  <h1>Aktivasi Akun Partner</h1>
  <p>Halo <strong>${(ownerName || '').replace(/</g, '&lt;')}</strong>,</p>
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
  <p>Surat MoU resmi terlampir dalam email ini. Silakan unduh dan simpan.</p>
  <p class="footer">Email ini dikirim otomatis oleh sistem Bintang Global Group. Pengirim: ${(emailConfig.fromName || 'Admin Pusat').replace(/</g, '&lt;')}.</p>
</body>
</html>`;

  const text = `Aktivasi Akun Partner\n\nHalo ${ownerName},\n\nAkun Anda telah diaktivasi.\n\nEmail login: ${toEmail}\nPassword baru: ${newPassword}\n\nPassword lama tidak berlaku. Surat MoU terlampir.\n\n— ${emailConfig.fromName}`;

  try {
    await trans.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
      to: toEmail,
      subject,
      text,
      html,
      attachments
    });
    logger.info('Email MOU terkirim ke ' + toEmail);
    return true;
  } catch (err) {
    logger.error('Gagal kirim email MOU ke ' + toEmail, err.message);
    return false;
  }
}

module.exports = { sendMouToOwner, getTransporter };
