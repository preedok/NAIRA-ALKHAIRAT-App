const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');
const { User, TravelProfile, Branch, TravelBalanceTransaction } = require('../models');
const { ROLES, TRAVEL_STATUS, MOU_REGISTRATION_FEE_IDR } = require('../constants');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const { generateMouPdf } = require('../utils/mouPdf');
const { sendMouToTravel } = require('../utils/emailService');

const KOORDINATOR_ROLES = [ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
function isKoordinatorRole(role) {
  return KOORDINATOR_ROLES.includes(role);
}
const uploadConfig = require('../config/uploads');

/**
 * POST /api/v1/travels/register
 * Calon Travel registrasi + upload bukti bayar MoU + input jumlah di awal.
 */
const register = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    name,
    phone,
    company_name,
    address,
    operational_region,
    whatsapp,
    npwp,
    preferred_branch_id,
    registration_payment_amount: amountRaw
  } = req.body;

  const emailNorm = (email != null && email !== '') ? String(email).trim().toLowerCase() : '';
  if (!emailNorm) {
    return res.status(400).json({ success: false, message: 'Email wajib diisi' });
  }
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password wajib minimal 6 karakter' });
  }
  const existing = await User.findOne({ where: { email: emailNorm } });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Bukti bayar MoU wajib diupload' });
  }

  const amount = amountRaw != null && amountRaw !== '' ? parseFloat(String(amountRaw).replace(/[^\d.-]/g, '')) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Jumlah pembayaran MoU wajib diisi dan harus lebih dari 0' });
  }

  let operationalRegion = operational_region;
  if (preferred_branch_id) {
    const branch = await Branch.findByPk(preferred_branch_id);
    if (branch) operationalRegion = branch.region || operationalRegion;
  }

  const user = await User.create({
    email: emailNorm,
    password_hash: password,
    name: String(name).trim(),
    phone: phone != null && phone !== '' ? String(phone).trim() : null,
    company_name: company_name != null && company_name !== '' ? String(company_name).trim() : null,
    role: ROLES.TRAVEL,
    is_active: true
  });

  const proofUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT, req.file.filename);

  await TravelProfile.create({
    user_id: user.id,
    status: TRAVEL_STATUS.PENDING_REGISTRATION_VERIFICATION,
    address,
    operational_region: operationalRegion,
    preferred_branch_id: preferred_branch_id || null,
    whatsapp: whatsapp || phone,
    npwp,
    registration_payment_proof_url: proofUrl,
    registration_payment_amount: amount
  });

  const u = user.toJSON();
  delete u.password_hash;
  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil. Bukti bayar Anda akan diverifikasi oleh Admin Pusat. Setelah verifikasi dan aktivasi akun, Anda dapat login dan mengakses fitur aplikasi.',
    data: { user: u, travel_status: TRAVEL_STATUS.PENDING_REGISTRATION_VERIFICATION }
  });
});

const uploadRegistrationPayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await TravelProfile.findOne({ where: { user_id: userId } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.PENDING_REGISTRATION_PAYMENT) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai. Upload bukti bayar hanya untuk akun yang baru mendaftar.' });
  }

  const url = req.file
    ? uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT, req.file.filename)
    : req.body.file_url;
  if (!url) return res.status(400).json({ success: false, message: 'File bukti bayar wajib' });

  await profile.update({
    registration_payment_proof_url: url,
    status: TRAVEL_STATUS.PENDING_REGISTRATION_VERIFICATION
  });

  res.json({
    success: true,
    message: 'Bukti bayar pendaftaran berhasil diupload. Menunggu verifikasi Admin Pusat.',
    data: { travel_status: profile.status }
  });
});

const uploadMou = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await TravelProfile.findOne({ where: { user_id: userId } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.REGISTERED_PENDING_MOU && profile.status !== TRAVEL_STATUS.PENDING_MOU_APPROVAL) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai untuk upload MoU' });
  }

  const mou_signed_url = req.file
    ? uploadConfig.toUrlPath(uploadConfig.SUBDIRS.MOU, req.file.filename)
    : req.body.mou_signed_url;
  if (!mou_signed_url) return res.status(400).json({ success: false, message: 'File MoU wajib' });

  await profile.update({
    mou_signed_url,
    mou_uploaded_at: new Date(),
    status: TRAVEL_STATUS.PENDING_MOU_APPROVAL
  });

  res.json({
    success: true,
    message: 'MoU berhasil diupload. Menunggu verifikasi Admin Pusat.',
    data: { travel_status: profile.status }
  });
});

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await TravelProfile.findOne({
    where: { user_id: req.user.id },
    include: [{ model: Branch, as: 'AssignedBranch', attributes: ['id', 'code', 'name'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil tidak ditemukan' });
  res.json({ success: true, data: profile });
});

const getMyBalance = asyncHandler(async (req, res) => {
  const profile = await TravelProfile.findOne({ where: { user_id: req.user.id } });
  const balance = profile ? parseFloat(profile.balance) || 0 : 0;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const transactions = await TravelBalanceTransaction.findAll({
    where: { travel_id: req.user.id },
    order: [['created_at', 'DESC']],
    limit
  });
  res.json({
    success: true,
    data: {
      balance,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: parseFloat(t.amount),
        type: t.type,
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        notes: t.notes,
        created_at: t.created_at
      }))
    }
  });
});

const getById = asyncHandler(async (req, res) => {
  const profile = await TravelProfile.findByPk(req.params.id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] },
      { model: Branch, as: 'PreferredBranch', attributes: ['id', 'code', 'name', 'region'], required: false },
      { model: Branch, as: 'AssignedBranch', attributes: ['id', 'code', 'name'], required: false }
    ]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  const isKoordinator = isKoordinatorRole(req.user.role);
  if (isKoordinator && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    const allowed = (profile.assigned_branch_id && branchIds.includes(profile.assigned_branch_id)) || profile.status === TRAVEL_STATUS.DEPOSIT_VERIFIED;
    if (!allowed) return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  res.json({ success: true, data: profile });
});

async function buildTravelWhere(req) {
  const { status, branch_id, wilayah_id: queryWilayahId } = req.query;
  const where = {};
  if (status) where.status = status;

  const isKoordinator = isKoordinatorRole(req.user.role);
  const userWilayahId = req.user.wilayah_id;
  let branchIdsWilayah = null;
  if (isKoordinator && userWilayahId) {
    branchIdsWilayah = await getBranchIdsForWilayah(userWilayahId);
  } else if (queryWilayahId) {
    branchIdsWilayah = await getBranchIdsForWilayah(queryWilayahId);
  }

  if (branch_id) where.assigned_branch_id = branch_id;
  else if (queryWilayahId && branchIdsWilayah && branchIdsWilayah.length > 0) {
    where[Op.or] = [
      { assigned_branch_id: { [Op.in]: branchIdsWilayah } },
      { status: TRAVEL_STATUS.DEPOSIT_VERIFIED }
    ];
  } else if (isKoordinator && userWilayahId && branchIdsWilayah && branchIdsWilayah.length > 0) {
    where[Op.or] = [
      { assigned_branch_id: { [Op.in]: branchIdsWilayah } },
      { status: TRAVEL_STATUS.DEPOSIT_VERIFIED }
    ];
  }
  return where;
}

const getStats = asyncHandler(async (req, res) => {
  const where = await buildTravelWhere(req);
  const sequelize = TravelProfile.sequelize;

  const total = await TravelProfile.count({ where });

  const rows = await TravelProfile.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true
  });

  const byStatus = {};
  Object.values(TRAVEL_STATUS).forEach((s) => { byStatus[s] = 0; });
  rows.forEach((r) => {
    byStatus[r.status] = parseInt(r.count, 10) || 0;
  });

  const active = byStatus[TRAVEL_STATUS.ACTIVE] || 0;
  const siapAktivasi = (byStatus[TRAVEL_STATUS.DEPOSIT_VERIFIED] || 0) + (byStatus[TRAVEL_STATUS.ASSIGNED_TO_BRANCH] || 0);
  const pendingVerifikasi = (byStatus[TRAVEL_STATUS.PENDING_REGISTRATION_VERIFICATION] || 0) + (byStatus[TRAVEL_STATUS.PENDING_DEPOSIT_VERIFICATION] || 0);
  const pendingMoU = (byStatus[TRAVEL_STATUS.REGISTERED_PENDING_MOU] || 0) + (byStatus[TRAVEL_STATUS.PENDING_MOU_APPROVAL] || 0);
  const rejected = byStatus[TRAVEL_STATUS.REJECTED] || 0;
  const pendingBayar = (byStatus[TRAVEL_STATUS.PENDING_REGISTRATION_PAYMENT] || 0) + (byStatus[TRAVEL_STATUS.PENDING_DEPOSIT_PAYMENT] || 0);

  res.json({
    success: true,
    data: {
      total_travels: total,
      active,
      siap_aktivasi: siapAktivasi,
      pending_verifikasi: pendingVerifikasi,
      pending_mou: pendingMoU,
      pending_bayar: pendingBayar,
      rejected,
      by_status: byStatus
    }
  });
});

const list = asyncHandler(async (req, res) => {
  const { q: search, page = 1, limit = 50 } = req.query;
  const where = await buildTravelWhere(req);

  const userWhere = {};
  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    userWhere[Op.or] = [
      { name: { [Op.iLike]: term } },
      { company_name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } }
    ];
  }

  const includeUser = {
    model: User,
    as: 'User',
    attributes: ['id', 'email', 'name', 'phone', 'company_name'],
    required: Object.keys(userWhere).length > 0,
    where: Object.keys(userWhere).length > 0 ? userWhere : undefined
  };
  const includePreferred = { model: Branch, as: 'PreferredBranch', attributes: ['id', 'code', 'name', 'region'], required: false };
  const includeAssigned = { model: Branch, as: 'AssignedBranch', attributes: ['id', 'code', 'name'], required: false };

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const { count, rows } = await TravelProfile.findAndCountAll({
    where,
    include: [includeUser, includePreferred, includeAssigned],
    limit: lim,
    offset,
    order: [['created_at', 'DESC']],
    distinct: true
  });

  res.json({ success: true, data: rows, total: count, page: pg, limit: lim });
});

const verifyMou = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, rejection_reason } = req.body;
  const profile = await TravelProfile.findByPk(id, {
    include: [{ model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.PENDING_MOU_APPROVAL) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai' });
  }

  if (approved === false) {
    await profile.update({
      status: TRAVEL_STATUS.REJECTED,
      mou_rejected_reason: rejection_reason
    });
    return res.json({ success: true, message: 'MoU ditolak', data: { travel_status: profile.status } });
  }

  await profile.update({ status: TRAVEL_STATUS.PENDING_DEPOSIT_PAYMENT });
  res.json({
    success: true,
    message: 'MoU disetujui. Travel dapat melakukan transfer deposit.',
    data: { travel_status: TRAVEL_STATUS.PENDING_DEPOSIT_PAYMENT }
  });
});

const verifyRegistrationPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, rejection_reason } = req.body;
  const profile = await TravelProfile.findByPk(id, {
    include: [{ model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.PENDING_REGISTRATION_VERIFICATION) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai. Hanya travel yang sudah upload bukti bayar pendaftaran yang dapat diverifikasi.' });
  }

  if (approved === false) {
    await profile.update({
      status: TRAVEL_STATUS.REJECTED,
      mou_rejected_reason: rejection_reason
    });
    return res.json({ success: true, message: 'Bukti bayar pendaftaran ditolak.', data: { travel_status: profile.status } });
  }

  await profile.update({
    status: TRAVEL_STATUS.DEPOSIT_VERIFIED,
    registration_payment_verified_at: new Date(),
    registration_payment_verified_by: req.user.id
  });
  res.json({
    success: true,
    message: 'Bukti bayar pendaftaran disetujui. Tetapkan cabang lalu aktivasi travel.',
    data: { travel_status: TRAVEL_STATUS.DEPOSIT_VERIFIED }
  });
});

const verifyDeposit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await TravelProfile.findByPk(id);
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.PENDING_DEPOSIT_VERIFICATION) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai' });
  }

  await profile.update({
    status: TRAVEL_STATUS.DEPOSIT_VERIFIED,
    deposit_verified_at: new Date(),
    deposit_verified_by: req.user.id
  });
  res.json({ success: true, message: 'Deposit terverifikasi', data: { travel_status: profile.status } });
});

const assignBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { branch_id } = req.body;
  const profile = await TravelProfile.findByPk(id);
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.DEPOSIT_VERIFIED) {
    return res.status(400).json({ success: false, message: 'Deposit harus terverifikasi dulu' });
  }

  const branch = await Branch.findByPk(branch_id);
  if (!branch) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
  if (isKoordinatorRole(req.user.role)) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (!branchIds.includes(branch_id)) return res.status(403).json({ success: false, message: 'Hanya dapat menetapkan ke cabang di wilayah Anda' });
  }

  await User.update({ branch_id }, { where: { id: profile.user_id } });
  await profile.update({
    assigned_branch_id: branch_id,
    assigned_at: new Date(),
    status: TRAVEL_STATUS.ASSIGNED_TO_BRANCH
  });
  res.json({ success: true, message: 'Cabang berhasil ditetapkan', data: { travel_status: TRAVEL_STATUS.ASSIGNED_TO_BRANCH } });
});

const activate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await TravelProfile.findByPk(id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] },
      { model: Branch, as: 'AssignedBranch', attributes: ['id', 'name', 'code'], required: false },
      { model: Branch, as: 'PreferredBranch', attributes: ['id', 'name', 'code'], required: false }
    ]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Travel tidak ditemukan' });
  if (profile.status !== TRAVEL_STATUS.ASSIGNED_TO_BRANCH && profile.status !== TRAVEL_STATUS.DEPOSIT_VERIFIED) {
    return res.status(400).json({ success: false, message: 'Travel harus sudah verifikasi bukti bayar. Cabang diisi otomatis dari pilihan saat pendaftaran.' });
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN_PUSAT) {
    if (isKoordinatorRole(req.user.role)) {
      const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
      const branchId = profile.assigned_branch_id || profile.preferred_branch_id;
      if (!branchId || !branchIds.includes(branchId)) {
        return res.status(403).json({ success: false, message: 'Travel ini bukan di wilayah Anda.' });
      }
    } else if (profile.assigned_branch_id !== req.user.branch_id) {
      return res.status(403).json({ success: false, message: 'Bukan cabang Anda' });
    }
  }

  const newPassword = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, (m) => ({ '+': '', '/': '', '=': '' }[m] || m)).slice(0, 12) || crypto.randomBytes(6).toString('hex');
  const user = profile.User;
  if (!user) return res.status(500).json({ success: false, message: 'Data user travel tidak ditemukan' });

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);
  await User.update({ password_hash }, { where: { id: user.id } });

  const assignedBranchName = (profile.AssignedBranch && profile.AssignedBranch.name) || (profile.PreferredBranch && profile.PreferredBranch.name) || (profile.preferred_branch_id ? (await Branch.findByPk(profile.preferred_branch_id, { attributes: ['name'] }))?.name : null) || 'Cabang Bintang Global';
  const mou_generated_url = await generateMouPdf({
    user: user.get ? user.get({ plain: true }) : user,
    travelProfile: profile.get ? profile.get({ plain: true }) : profile,
    newPassword,
    assignedBranchName
  });

  await profile.update({
    status: TRAVEL_STATUS.ACTIVE,
    activated_at: new Date(),
    activated_by: req.user.id,
    mou_generated_url,
    assigned_branch_id: profile.assigned_branch_id || profile.preferred_branch_id,
    activation_generated_password: newPassword
  });
  await User.update(
    { branch_id: profile.assigned_branch_id || profile.preferred_branch_id },
    { where: { id: user.id } }
  );

  const mouDir = uploadConfig.getDir(uploadConfig.SUBDIRS.MOU);
  const mouFilePath = path.join(mouDir, path.basename(mou_generated_url));
  const emailSent = await sendMouToTravel(user.email, user.name, newPassword, mouFilePath);

  res.json({
    success: true,
    message: emailSent
      ? 'Travel berhasil diaktifkan. Email berisi MOU dan password baru telah dikirim ke email travel.'
      : 'Travel berhasil diaktifkan. Password baru dan MOU telah digenerate. Email tidak terkirim (periksa konfigurasi SMTP). Berikan password dan link MOU kepada travel.',
    data: {
      travel_status: TRAVEL_STATUS.ACTIVE,
      generated_password: newPassword,
      mou_generated_url,
      email_sent: emailSent
    }
  });
});

module.exports = {
  register,
  uploadRegistrationPayment,
  uploadMou,
  getMyProfile,
  getMyBalance,
  getStats,
  list,
  getById,
  verifyMou,
  verifyRegistrationPayment,
  verifyDeposit,
  assignBranch,
  activate
};
