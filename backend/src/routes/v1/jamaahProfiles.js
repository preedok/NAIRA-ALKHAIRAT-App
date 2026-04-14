const express = require('express');
const asyncHandler = require('express-async-handler');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES, normalizeRole } = require('../../constants');
const { JamaahProfile, JamaahDocument, User } = require('../../models');

const router = express.Router();
router.use(auth);

router.get('/me', requireRole(ROLES.USER), asyncHandler(async (req, res) => {
  const profile = await JamaahProfile.findOne({
    where: { user_id: req.user.id },
    include: [{ model: JamaahDocument, as: 'Documents' }]
  });
  res.json({ success: true, data: profile });
}));

router.post('/me', requireRole(ROLES.USER), asyncHandler(async (req, res) => {
  const [profile] = await JamaahProfile.upsert({ ...req.body, user_id: req.user.id }, { returning: true });
  res.json({ success: true, data: profile });
}));

router.post('/me/submit', requireRole(ROLES.USER), asyncHandler(async (req, res) => {
  const profile = await JamaahProfile.findOne({ where: { user_id: req.user.id } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil jamaah belum diisi' });
  await profile.update({ profile_status: 'under_review', submitted_at: new Date() });
  res.json({ success: true, message: 'Profil dikirim untuk verifikasi admin' });
}));

router.post('/me/documents', requireRole(ROLES.USER), asyncHandler(async (req, res) => {
  const profile = await JamaahProfile.findOne({ where: { user_id: req.user.id } });
  if (!profile) return res.status(404).json({ success: false, message: 'Isi profil terlebih dulu' });
  const { doc_type, file_url } = req.body;
  const [doc] = await JamaahDocument.upsert({
    jamaah_profile_id: profile.id,
    doc_type,
    file_url,
    verification_status: 'pending',
    rejection_reason: null,
    verified_by: null,
    verified_at: null
  }, { returning: true });
  res.json({ success: true, data: doc });
}));

router.get('/admin/pending', requireRole(ROLES.ADMIN), asyncHandler(async (_req, res) => {
  const myRole = normalizeRole(_req.user?.role);
  const userWhere = {};
  if (myRole === ROLES.ADMIN_CABANG) userWhere.branch_id = _req.user.branch_id || null;
  const profiles = await JamaahProfile.findAll({
    where: { profile_status: 'under_review' },
    include: [
      { model: JamaahDocument, as: 'Documents' },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'branch_id'], where: userWhere, required: true }
    ]
  });
  res.json({ success: true, data: profiles });
}));

router.patch('/admin/:profileId/documents/:docId/verify', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status verifikasi tidak valid' });
  }
  const doc = await JamaahDocument.findOne({
    where: { id: req.params.docId, jamaah_profile_id: req.params.profileId }
  });
  if (!doc) return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan' });
  await doc.update({
    verification_status: status,
    rejection_reason: status === 'rejected' ? (rejection_reason || 'Dokumen belum sesuai') : null,
    verified_by: req.user.id,
    verified_at: new Date()
  });
  res.json({ success: true, data: doc });
}));

router.patch('/admin/:profileId/finalize', requireRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status final tidak valid' });
  }
  const profile = await JamaahProfile.findByPk(req.params.profileId, { include: [{ model: User, as: 'User', attributes: ['id', 'branch_id'] }] });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil tidak ditemukan' });
  const myRole = normalizeRole(req.user?.role);
  if (myRole === ROLES.ADMIN_CABANG && profile.User?.branch_id !== req.user.branch_id) {
    return res.status(403).json({ success: false, message: 'Anda hanya bisa memverifikasi profil jamaah cabang Anda' });
  }
  await profile.update({ profile_status: status, reviewed_by: req.user.id, reviewed_at: new Date() });
  res.json({ success: true, data: profile });
}));

module.exports = router;
