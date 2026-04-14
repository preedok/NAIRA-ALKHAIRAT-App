const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { normalizeRole, isAdminRole } = require('../constants');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'bintang-global-secret-change-in-production';

const signToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Akun tidak aktif' });
    }

    req.user = user;
    req.user.canonical_role = normalizeRole(user.role);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token tidak valid' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token kedaluwarsa' });
    }
    logger.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Kesalahan server' });
  }
};

/**
 * RBAC: require one of the given roles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userRole = normalizeRole(req.user.role);
    const normalizedAllowed = allowedRoles.map((role) => normalizeRole(role));
    if (normalizedAllowed.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Akses ditolak untuk role ini' });
  };
};

/**
 * Branch restriction: user can only access data of their branch.
 */
const branchRestriction = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (isAdminRole(req.user.role)) {
    return next();
  }
  req.branchFilter = { branch_id: req.user.branch_id };
  next();
};

module.exports = {
  JWT_SECRET,
  signToken,
  auth,
  requireRole,
  branchRestriction
};
