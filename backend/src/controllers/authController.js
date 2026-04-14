const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { User, OtpVerification, Branch } = require('../models');
const { signToken } = require('../middleware/auth');
const { ROLES, normalizeRole } = require('../constants');

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_RESEND = 3;
const googleClient = new OAuth2Client();

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

function buildMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

async function sendOtpEmail(email, otpCode) {
  const transporter = buildMailer();
  if (!transporter) return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'Bintang Global';
  await transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to: email,
    subject: 'Kode OTP Verifikasi Akun',
    text: `Kode OTP Anda: ${otpCode}. Berlaku ${OTP_EXPIRY_MINUTES} menit.`,
    html: `<p>Assalamu'alaikum,</p><p>Kode OTP verifikasi akun Anda adalah:</p><h2 style="letter-spacing:4px;">${otpCode}</h2><p>Kode berlaku selama ${OTP_EXPIRY_MINUTES} menit.</p>`
  });
  return { sent: true };
}

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, whatsapp, password, branch_id } = req.body;
  if (!name || !email || !password || !(phone || whatsapp)) {
    return res.status(400).json({ success: false, message: 'Nama, email, password, dan nomor WhatsApp wajib diisi' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = String(whatsapp || phone).trim();

  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(password), salt);
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    branch_id: branch_id || null,
    password_hash: passwordHash,
    role: ROLES.USER,
    is_active: false
  });

  const otpCode = generateOtpCode();
  await OtpVerification.create({
    user_id: user.id,
    otp_code: otpCode,
    channel: 'email',
    expires_at: getOtpExpiryDate()
  });

  let emailSent = false;
  let emailStatus = 'SMTP_NOT_CONFIGURED';
  try {
    const result = await sendOtpEmail(normalizedEmail, otpCode);
    emailSent = result.sent;
    emailStatus = result.reason || 'SENT';
  } catch (_e) {
    emailSent = false;
    emailStatus = 'SEND_FAILED';
  }

  res.status(201).json({
    success: true,
    message: emailSent
      ? 'Registrasi berhasil. OTP telah dikirim ke email Anda.'
      : 'Registrasi berhasil. OTP dibuat, tetapi email belum terkirim. Periksa konfigurasi SMTP.',
    data: {
      user_id: user.id,
      otp_expiry_minutes: OTP_EXPIRY_MINUTES,
      max_resend: OTP_MAX_RESEND,
      otp_delivery: { channel: 'email', sent: emailSent, status: emailStatus }
    }
  });
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi' });

  const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

  const latestOtp = await OtpVerification.findOne({
    where: { user_id: user.id, verified_at: null },
    order: [['created_at', 'DESC']]
  });
  if (latestOtp && Number(latestOtp.resend_count || 0) >= OTP_MAX_RESEND) {
    return res.status(429).json({ success: false, message: 'Batas kirim ulang OTP telah tercapai' });
  }

  const nextResendCount = latestOtp ? Number(latestOtp.resend_count || 0) + 1 : 1;
  const otpCode = generateOtpCode();
  await OtpVerification.create({
    user_id: user.id,
    otp_code: otpCode,
    channel: 'email',
    expires_at: getOtpExpiryDate(),
    resend_count: nextResendCount
  });

  let emailSent = false;
  let emailStatus = 'SMTP_NOT_CONFIGURED';
  try {
    const result = await sendOtpEmail(user.email, otpCode);
    emailSent = result.sent;
    emailStatus = result.reason || 'SENT';
  } catch (_e) {
    emailSent = false;
    emailStatus = 'SEND_FAILED';
  }

  res.json({
    success: true,
    message: emailSent
      ? 'OTP berhasil dikirim ulang ke email Anda.'
      : 'OTP dibuat, tetapi email belum terkirim. Periksa konfigurasi SMTP.',
    data: {
      resend_count: nextResendCount,
      otp_delivery: { channel: 'email', sent: emailSent, status: emailStatus }
    }
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp_code } = req.body;
  if (!email || !otp_code) return res.status(400).json({ success: false, message: 'Email dan OTP wajib diisi' });

  const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

  const otp = await OtpVerification.findOne({
    where: { user_id: user.id, verified_at: null },
    order: [['created_at', 'DESC']]
  });
  if (!otp) return res.status(400).json({ success: false, message: 'OTP tidak ditemukan. Silakan kirim ulang OTP.' });
  if (otp.expires_at && new Date(otp.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: 'OTP sudah kedaluwarsa. Silakan kirim ulang OTP.' });
  }
  if (String(otp_code).trim() !== String(otp.otp_code)) {
    return res.status(400).json({ success: false, message: 'Kode OTP tidak valid' });
  }

  await otp.update({ verified_at: new Date() });
  await user.update({ is_active: true });

  const canonicalRole = normalizeRole(user.role);
  const token = signToken(user.id, user.email, canonicalRole);
  const u = user.toJSON();
  delete u.password_hash;
  u.role = canonicalRole;

  res.json({ success: true, message: 'OTP berhasil diverifikasi. Akun telah aktif.', data: { user: u, token } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email dan password wajib' });

  const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) return res.status(401).json({ success: false, message: 'Email tidak ditemukan' });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(401).json({ success: false, message: 'Password salah' });
  if (!user.is_active) return res.status(403).json({ success: false, message: 'Akun tidak aktif' });

  await user.update({ last_login_at: new Date() });
  const canonicalRole = normalizeRole(user.role);
  const token = signToken(user.id, user.email, canonicalRole);
  const u = user.toJSON();
  delete u.password_hash;
  u.role = canonicalRole;

  res.json({ success: true, message: 'Login berhasil', data: { user: u, token } });
});

const loginWithGoogle = asyncHandler(async (req, res) => {
  const { id_token, branch_id } = req.body;
  if (!id_token) {
    return res.status(400).json({ success: false, message: 'Google token wajib diisi' });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(500).json({
      success: false,
      message: 'Google Login belum dikonfigurasi. Set GOOGLE_CLIENT_ID pada backend.'
    });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: String(id_token),
      audience: googleClientId
    });
    payload = ticket.getPayload();
  } catch (_e) {
    return res.status(401).json({ success: false, message: 'Token Google tidak valid' });
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  const name = String(payload?.name || '').trim();
  if (!email || !name || payload?.email_verified !== true) {
    return res.status(400).json({
      success: false,
      message: 'Akun Google tidak valid atau email belum terverifikasi'
    });
  }

  let user = await User.findOne({ where: { email } });
  if (!user) {
    let wilayah_id = null;
    if (branch_id) {
      const b = await Branch.findByPk(branch_id);
      if (b) wilayah_id = b.wilayah_id;
    }
    user = await User.create({
      name,
      email,
      role: ROLES.USER,
      is_active: true,
      phone: null,
      branch_id: branch_id || null,
      wilayah_id,
      password_hash: null
    });
  } else if (!user.is_active) {
    await user.update({ is_active: true });
  }

  await user.update({ last_login_at: new Date() });
  const canonicalRole = normalizeRole(user.role);
  const token = signToken(user.id, user.email, canonicalRole);
  const u = user.toJSON();
  delete u.password_hash;
  u.role = canonicalRole;

  res.json({ success: true, message: 'Login Google berhasil', data: { user: u, token } });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash'] } });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  const u = user.toJSON();
  u.role = normalizeRole(u.role);
  res.json({ success: true, data: u });
});

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Password lama dan password baru wajib' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
  }
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  const valid = await user.comparePassword(current_password);
  if (!valid) return res.status(401).json({ success: false, message: 'Password lama salah' });

  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash(new_password, salt);
  await user.save();
  res.json({ success: true, message: 'Password berhasil diubah' });
});

const activity = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'last_login_at'] });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  res.json({ success: true, data: { last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null } });
});

module.exports = { login, loginWithGoogle, me, changePassword, activity, register, resendOtp, verifyOtp };
