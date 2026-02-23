const asyncHandler = require('express-async-handler');
const { Notification } = require('../models');

/**
 * GET /api/v1/notifications
 * Daftar notifikasi untuk user yang login. Query: unread_only=1, limit=20, page=1
 */
const list = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const unreadOnly = req.query.unread_only === '1' || req.query.unread_only === 'true';
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * limit;

  const where = { user_id: userId };
  if (unreadOnly) where.read_at = null;

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    attributes: ['id', 'trigger', 'title', 'message', 'data', 'read_at', 'created_at']
  });

  const pagination = { total: count, page, limit, totalPages: Math.ceil(count / limit) };
  res.json({ success: true, data: rows, pagination });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Tandai satu notifikasi sebagai sudah dibaca
 */
const markRead = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const notif = await Notification.findOne({
    where: { id: req.params.id, user_id: userId }
  });
  if (!notif) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan' });

  await notif.update({ read_at: new Date() });
  res.json({ success: true, data: notif });
});

/**
 * PATCH /api/v1/notifications/read-all
 * Tandai semua notifikasi user sebagai sudah dibaca
 */
const markAllRead = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  await Notification.update(
    { read_at: new Date() },
    { where: { user_id: userId, read_at: null } }
  );
  res.json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca' });
});

/**
 * GET /api/v1/notifications/unread-count
 * Jumlah notifikasi belum dibaca (untuk badge)
 */
const unreadCount = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const count = await Notification.count({
    where: { user_id: userId, read_at: null }
  });
  res.json({ success: true, data: { count } });
});

module.exports = { list, markRead, markAllRead, unreadCount };
