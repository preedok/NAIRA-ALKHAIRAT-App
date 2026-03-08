const asyncHandler = require('express-async-handler');
const { User, OwnerProfile } = require('../models');
const { signToken } = require('../middleware/auth');
const { ROLES, OWNER_STATUS, isOwnerRole } = require('../constants');
const logger = require('../config/logger');

/**
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib' });
  }

  let user;
  try {
    user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [{ model: require('../models').Branch, as: 'Branch', attributes: ['id', 'code', 'name'] }]
    });
  } catch (err) {
    const dbMessage = (err && err.original && err.original.message) ? err.original.message : (err && err.message) ? String(err.message) : String(err);
    logger.error('Login DB error:', dbMessage);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Kesalahan server' : dbMessage
    });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: 'Email tidak ditemukan' });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Password salah' });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Akun tidak aktif' });
  }

  if (isOwnerRole(user.role)) {
    const profile = await OwnerProfile.findOne({ where: { user_id: user.id } });
    if (profile) {
      const status = profile.status;
      const allowedStatuses = [OWNER_STATUS.PENDING_REGISTRATION_PAYMENT, OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION, OWNER_STATUS.DEPOSIT_VERIFIED, OWNER_STATUS.ASSIGNED_TO_BRANCH, OWNER_STATUS.ACTIVE];
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({
          success: false,
          message: status === 'rejected' ? 'Akun ditolak. Hubungi admin.' : 'Akun Owner belum dapat digunakan.',
          owner_status: status
        });
      }
      user.owner_status = status;
    }
  }

  try {
    await user.update({ last_login_at: new Date() });
  } catch (e) {
    logger.warn('Login: update last_login_at failed (non-fatal):', e && e.message);
  }

  const token = signToken(user.id, user.email, user.role);
  const u = user.toJSON();
  delete u.password_hash;
  const payload = {
    ...u,
    branch_name: user.Branch ? user.Branch.name : null
  };
  if (isOwnerRole(user.role) && user.owner_status) {
    payload.owner_status = user.owner_status;
  }

  res.json({
    success: true,
    message: 'Login berhasil',
    data: {
      user: payload,
      token
    }
  });
});

/**
 * GET /api/v1/auth/me
 */
const me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password_hash'] },
    include: [
      { model: require('../models').Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city'] }
    ]
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  const u = user.toJSON();
  if (isOwnerRole(user.role)) {
    const profile = await OwnerProfile.findOne({ where: { user_id: user.id } });
    u.owner_status = profile ? profile.status : null;
    u.has_special_price = profile ? profile.has_special_price : false;
  }
  res.json({ success: true, data: u });
});

/**
 * POST /api/v1/auth/change-password
 * Ubah password (untuk owner atau user lain). Wajib: current_password, new_password.
 */
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
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Password lama salah' });
  }
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  user.password_hash = await bcrypt.hash(new_password, salt);
  await user.save();
  res.json({ success: true, message: 'Password berhasil diubah' });
});

/**
 * GET /api/v1/auth/activity
 * Mengembalikan last_login_at user saat ini (untuk tampilan "terakhir aktif" / online).
 */
const activity = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'last_login_at']
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  res.json({
    success: true,
    data: {
      last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null
    }
  });
});

module.exports = { login, me, changePassword, activity };
