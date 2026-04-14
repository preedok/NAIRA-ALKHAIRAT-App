const express = require('express');
const asyncHandler = require('express-async-handler');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES, normalizeRole } = require('../../constants');
const { Kloter, KloterAssignment } = require('../../models');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(async (_req, res) => {
  const where = {};
  const myRole = normalizeRole(_req.user?.role);
  if (myRole === ROLES.ADMIN_CABANG || myRole === ROLES.JAMAAH) {
    where.branch_id = _req.user.branch_id || null;
  }
  const kloters = await Kloter.findAll({ where, order: [['departure_date', 'ASC']] });
  res.json({ success: true, data: kloters });
}));

router.post('/', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const myRole = normalizeRole(req.user?.role);
  const payload = { ...req.body, created_by: req.user.id };
  if (myRole === ROLES.ADMIN_CABANG) payload.branch_id = req.user.branch_id || null;
  if (!payload.branch_id) {
    return res.status(400).json({ success: false, message: 'branch_id wajib diisi untuk kloter' });
  }
  const kloter = await Kloter.create(payload);
  res.status(201).json({ success: true, data: kloter });
}));

router.post('/:id/assignments', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const { order_id, user_id } = req.body;
  const assignment = await KloterAssignment.create({
    kloter_id: req.params.id,
    order_id,
    user_id,
    assigned_by: req.user.id
  });
  await Kloter.increment('filled_quota', { by: 1, where: { id: req.params.id } });
  res.status(201).json({ success: true, data: assignment });
}));

router.patch('/assignments/:id/status', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const assignment = await KloterAssignment.findByPk(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Penugasan kloter tidak ditemukan' });
  await assignment.update({ departure_status: req.body.departure_status });
  res.json({ success: true, data: assignment });
}));

module.exports = router;
