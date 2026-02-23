/**
 * Konfigurasi email (nodemailer). Pengirim: Admin Pusat / Bintang Global.
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, EMAIL_FROM_NAME
 */
module.exports = {
  enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.EMAIL_FROM || process.env.SMTP_USER,
  fromName: process.env.EMAIL_FROM_NAME || 'Bintang Global - Admin Pusat'
};
