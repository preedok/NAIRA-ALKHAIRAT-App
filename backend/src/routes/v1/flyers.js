const express = require('express');
const asyncHandler = require('express-async-handler');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const { Flyer } = require('../../models');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(async (_req, res) => {
  const flyers = await Flyer.findAll({ order: [['created_at', 'DESC']] });
  res.json({ success: true, data: flyers });
}));

router.post('/', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const flyer = await Flyer.create({ ...req.body, created_by: req.user.id });
  res.status(201).json({ success: true, data: flyer });
}));

router.patch('/:id', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const flyer = await Flyer.findByPk(req.params.id);
  if (!flyer) return res.status(404).json({ success: false, message: 'Flyer tidak ditemukan' });
  await flyer.update(req.body);
  res.json({ success: true, data: flyer });
}));

router.post('/:id/download', asyncHandler(async (req, res) => {
  const flyer = await Flyer.findByPk(req.params.id);
  if (!flyer) return res.status(404).json({ success: false, message: 'Flyer tidak ditemukan' });
  await flyer.increment('download_count', { by: 1 });
  res.json({ success: true, data: { file_url: flyer.file_url } });
}));

module.exports = router;
