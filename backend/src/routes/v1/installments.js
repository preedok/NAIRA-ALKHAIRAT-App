const express = require('express');
const asyncHandler = require('express-async-handler');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const { InstallmentPlan, InstallmentItem } = require('../../models');

const router = express.Router();
router.use(auth);

router.get('/me', requireRole(ROLES.USER), asyncHandler(async (req, res) => {
  const plans = await InstallmentPlan.findAll({
    where: { owner_id: req.user.id },
    include: [{ model: InstallmentItem, as: 'Items' }],
    order: [['created_at', 'DESC']]
  });
  res.json({ success: true, data: plans });
}));

router.get('/admin', requireRole(ROLES.ADMIN), asyncHandler(async (_req, res) => {
  const plans = await InstallmentPlan.findAll({
    include: [{ model: InstallmentItem, as: 'Items' }],
    order: [['created_at', 'DESC']]
  });
  res.json({ success: true, data: plans });
}));

router.patch('/items/:id/status', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const item = await InstallmentItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Cicilan tidak ditemukan' });
  const { status } = req.body;
  if (!['pending', 'paid', 'late'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status cicilan tidak valid' });
  }
  await item.update({ status, paid_at: status === 'paid' ? new Date() : null });
  res.json({ success: true, data: item });
}));

module.exports = router;
