const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { User, OwnerProfile, Branch, OwnerBalanceTransaction } = require('../models');
const { ROLES, OWNER_STATUS, MOU_REGISTRATION_FEE_IDR, isOwnerRole } = require('../constants');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const { generateMouPdf } = require('../utils/mouPdf');
const { sendMouToOwner } = require('../utils/emailService');

const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
function isKoordinatorRole(role) {
  return KOORDINATOR_ROLES.includes(role);
}
const uploadConfig = require('../config/uploads');

/**
 * POST /api/v1/owners/register
 * Calon Owner registrasi. Body: is_mou_owner ('true'|'false').
 * - Owner MOU: wajib upload bukti bayar + jumlah (registration_payment_file, registration_payment_amount). Status = PENDING_REGISTRATION_VERIFICATION.
 * - Owner Non-MOU: tidak ada pembayaran (gratis); tetap status PENDING_REGISTRATION_VERIFICATION, validasi & aktivasi oleh Admin Pusat.
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
    registration_payment_amount: amountRaw,
    is_mou_owner: isMouOwnerRaw
  } = req.body;

  const isMouOwner = isMouOwnerRaw === 'true' || isMouOwnerRaw === true;

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
  const existing = await User.findOne({
    where: { email: emailNorm },
    include: [{ model: OwnerProfile, as: 'OwnerProfile', required: false }]
  });
  if (existing && existing.is_active) {
    return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
  }

  // Hanya Owner MOU yang wajib bukti bayar dan jumlah
  if (isMouOwner) {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti bayar MoU wajib diupload' });
    }
    const amount = amountRaw != null && amountRaw !== '' ? parseFloat(String(amountRaw).replace(/[^\d.-]/g, '')) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah pembayaran MoU wajib diisi dan harus lebih dari 0' });
    }
  }

  let operationalRegion = operational_region;
  if (preferred_branch_id) {
    const branch = await Branch.findByPk(preferred_branch_id);
    if (branch) operationalRegion = branch.region || operationalRegion;
  }

  let proofUrl = null;
  let amount = null;
  if (isMouOwner && req.file) {
    proofUrl = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT, req.file.filename);
    amount = amountRaw != null && amountRaw !== '' ? parseFloat(String(amountRaw).replace(/[^\d.-]/g, '')) : null;
  }

  let user;
  if (existing && !existing.is_active && isOwnerRole(existing.role) && existing.OwnerProfile) {
    // Reuse akun yang pernah dihapus (soft delete): aktifkan lagi dan update data registrasi
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    await existing.update({
      password_hash,
      name: String(name).trim(),
      phone: phone != null && phone !== '' ? String(phone).trim() : null,
      company_name: company_name != null && company_name !== '' ? String(company_name).trim() : null,
      is_active: true
    });
    await existing.OwnerProfile.update({
      status: OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION,
      address,
      operational_region: operationalRegion,
      preferred_branch_id: preferred_branch_id || null,
      whatsapp: whatsapp || phone,
      npwp,
      registration_payment_proof_url: proofUrl,
      registration_payment_amount: amount,
      is_mou_owner: isMouOwner
    });
    user = await User.findByPk(existing.id);
  } else if (existing && !existing.is_active) {
    return res.status(400).json({ success: false, message: 'Email sudah pernah dipakai. Gunakan email lain atau hubungi Admin.' });
  } else {
    user = await User.create({
      email: emailNorm,
      password_hash: password,
      name: String(name).trim(),
      phone: phone != null && phone !== '' ? String(phone).trim() : null,
      company_name: company_name != null && company_name !== '' ? String(company_name).trim() : null,
      role: isMouOwner ? ROLES.OWNER_MOU : ROLES.OWNER_NON_MOU,
      is_active: true
    });
    await OwnerProfile.create({
      user_id: user.id,
      status: OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION,
      address,
      operational_region: operationalRegion,
      preferred_branch_id: preferred_branch_id || null,
      whatsapp: whatsapp || phone,
      npwp,
      registration_payment_proof_url: proofUrl,
      registration_payment_amount: amount,
      is_mou_owner: isMouOwner
    });
  }

  const u = user.toJSON();
  delete u.password_hash;
  const message = isMouOwner
    ? 'Registrasi berhasil. Bukti bayar Anda akan diverifikasi oleh Admin Pusat. Setelah verifikasi dan aktivasi akun, Anda dapat login dan mengakses fitur aplikasi.'
    : 'Registrasi berhasil (gratis). Admin Pusat akan memvalidasi dan mengaktifkan akun Anda. Setelah diaktifkan, Anda dapat login dan mengakses fitur aplikasi.';
  res.status(201).json({
    success: true,
    message,
    data: { user: u, owner_status: OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION }
  });
});

/**
 * POST /api/v1/owners/upload-registration-payment
 * Owner upload bukti bayar pendaftaran. Status: PENDING_REGISTRATION_PAYMENT → PENDING_REGISTRATION_VERIFICATION
 */
const uploadRegistrationPayment = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.OWNER_NON_MOU) {
    return res.status(400).json({ success: false, message: 'Owner Non-MOU tidak perlu upload bukti bayar. Akun Anda akan diverifikasi dan diaktivasi oleh Admin Pusat.' });
  }
  const userId = req.user.id;
  const profile = await OwnerProfile.findOne({ where: { user_id: userId } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil owner tidak ditemukan' });
  if (profile.status !== OWNER_STATUS.PENDING_REGISTRATION_PAYMENT) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai. Upload bukti bayar hanya untuk akun yang baru mendaftar.' });
  }

  const url = req.file
    ? uploadConfig.toUrlPath(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT, req.file.filename)
    : req.body.file_url;
  if (!url) return res.status(400).json({ success: false, message: 'File bukti bayar wajib' });

  await profile.update({
    registration_payment_proof_url: url,
    status: OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION
  });

  res.json({
    success: true,
    message: 'Bukti bayar pendaftaran berhasil diupload. Menunggu verifikasi Admin Pusat.',
    data: { owner_status: profile.status }
  });
});

/**
 * POST /api/v1/owners/upload-mou (legacy - tetap ada untuk kompatibilitas)
 * Owner upload MoU yang sudah ditandatangani.
 */
const uploadMou = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await OwnerProfile.findOne({ where: { user_id: userId } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil owner tidak ditemukan' });
  if (profile.status !== OWNER_STATUS.REGISTERED_PENDING_MOU && profile.status !== OWNER_STATUS.PENDING_MOU_APPROVAL) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai untuk upload MoU' });
  }

  const mou_signed_url = req.file
    ? uploadConfig.toUrlPath(uploadConfig.SUBDIRS.MOU, req.file.filename)
    : req.body.mou_signed_url;
  if (!mou_signed_url) return res.status(400).json({ success: false, message: 'File MoU wajib' });

  await profile.update({
    mou_signed_url,
    mou_uploaded_at: new Date(),
    status: OWNER_STATUS.PENDING_MOU_APPROVAL
  });

  res.json({
    success: true,
    message: 'MoU berhasil diupload. Menunggu verifikasi Admin Pusat.',
    data: { owner_status: profile.status }
  });
});

/**
 * GET /api/v1/owners/me
 */
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await OwnerProfile.findOne({
    where: { user_id: req.user.id },
    include: [{ model: Branch, as: 'AssignedBranch', attributes: ['id', 'code', 'name'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil tidak ditemukan' });
  res.json({ success: true, data: profile });
});

/**
 * GET /api/v1/owners/me/balance
 * Saldo owner + riwayat transaksi (untuk order baru atau alokasi ke tagihan).
 */
const getMyBalance = asyncHandler(async (req, res) => {
  const profile = await OwnerProfile.findOne({ where: { user_id: req.user.id } });
  const balance = profile ? parseFloat(profile.balance) || 0 : 0;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const transactions = await OwnerBalanceTransaction.findAll({
    where: { owner_id: req.user.id },
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

/**
 * GET /api/v1/owners/user/:userId/balance
 * Saldo akun owner (by user_id) untuk tim invoice/admin — alokasi saldo ke invoice dari dashboard invoice.
 */
const getBalanceForUser = asyncHandler(async (req, res) => {
  const allowedStaff = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PUSAT,
    ROLES.INVOICE_KOORDINATOR,
    ROLES.ROLE_INVOICE_SAUDI
  ];
  if (!allowedStaff.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ success: false, message: 'userId wajib' });

  const profile = await OwnerProfile.findOne({ where: { user_id: userId } });
  if (!profile) return res.status(404).json({ success: false, message: 'Profil owner tidak ditemukan' });

  const isKoord = isKoordinatorRole(req.user.role);
  if (isKoord && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    const okBranch = profile.assigned_branch_id && branchIds.includes(profile.assigned_branch_id);
    const okVerified = profile.status === OWNER_STATUS.DEPOSIT_VERIFIED;
    if (!okBranch && !okVerified) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
  }

  const balance = parseFloat(profile.balance) || 0;
  res.json({ success: true, data: { balance, user_id: userId } });
});

/**
 * GET /api/v1/owners/:id (detail owner untuk Admin/Koordinator)
 */
const getById = asyncHandler(async (req, res) => {
  const profile = await OwnerProfile.findByPk(req.params.id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] },
      { model: Branch, as: 'PreferredBranch', attributes: ['id', 'code', 'name', 'region'], required: false },
      { model: Branch, as: 'AssignedBranch', attributes: ['id', 'code', 'name'], required: false }
    ]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  const isKoordinator = isKoordinatorRole(req.user.role);
  if (isKoordinator && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    const allowed = (profile.assigned_branch_id && branchIds.includes(profile.assigned_branch_id)) || profile.status === OWNER_STATUS.DEPOSIT_VERIFIED;
    if (!allowed) return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  res.json({ success: true, data: profile });
});

/** Build where clause for owner list/stats (shared by list and getStats) */
async function buildOwnerWhere(req) {
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
      { status: OWNER_STATUS.DEPOSIT_VERIFIED }
    ];
  } else if (isKoordinator && userWilayahId && branchIdsWilayah && branchIdsWilayah.length > 0) {
    where[Op.or] = [
      { assigned_branch_id: { [Op.in]: branchIdsWilayah } },
      { status: OWNER_STATUS.DEPOSIT_VERIFIED }
    ];
  }
  return where;
}

/**
 * GET /api/v1/owners/stats
 * Returns counts for Owners Wilayah (same scope as list: koordinator wilayah, optional status/branch_id/wilayah_id).
 */
const getStats = asyncHandler(async (req, res) => {
  const where = await buildOwnerWhere(req);
  const sequelize = OwnerProfile.sequelize;

  const total = await OwnerProfile.count({ where });

  const rows = await OwnerProfile.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true
  });

  const byStatus = {};
  Object.values(OWNER_STATUS).forEach((s) => { byStatus[s] = 0; });
  rows.forEach((r) => {
    byStatus[r.status] = parseInt(r.count, 10) || 0;
  });

  const active = byStatus[OWNER_STATUS.ACTIVE] || 0;
  const siapAktivasi = (byStatus[OWNER_STATUS.DEPOSIT_VERIFIED] || 0) + (byStatus[OWNER_STATUS.ASSIGNED_TO_BRANCH] || 0);
  const pendingVerifikasi = (byStatus[OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION] || 0) + (byStatus[OWNER_STATUS.PENDING_DEPOSIT_VERIFICATION] || 0);
  const pendingMoU = (byStatus[OWNER_STATUS.REGISTERED_PENDING_MOU] || 0) + (byStatus[OWNER_STATUS.PENDING_MOU_APPROVAL] || 0);
  const rejected = byStatus[OWNER_STATUS.REJECTED] || 0;
  const pendingBayar = (byStatus[OWNER_STATUS.PENDING_REGISTRATION_PAYMENT] || 0) + (byStatus[OWNER_STATUS.PENDING_DEPOSIT_PAYMENT] || 0);

  res.json({
    success: true,
    data: {
      total_owners: total,
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

/**
 * GET /api/v1/owners (Admin Pusat / Super Admin / Koordinator / Accounting)
 * Query: status, branch_id, wilayah_id, search (q), page, limit.
 * Koordinator: hanya owner yang assigned ke cabang di wilayah mereka, atau DEPOSIT_VERIFIED.
 */
const list = asyncHandler(async (req, res) => {
  const { q: search, page = 1, limit = 50 } = req.query;
  const where = await buildOwnerWhere(req);

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

  const { count, rows } = await OwnerProfile.findAndCountAll({
    where,
    include: [includeUser, includePreferred, includeAssigned],
    limit: lim,
    offset,
    order: [['created_at', 'DESC']],
    distinct: true
  });

  res.json({ success: true, data: rows, total: count, page: pg, limit: lim });
});

/**
 * PATCH /api/v1/owners/:id/verify-mou (Admin Pusat)
 * Verifikasi MoU: approve -> PENDING_DEPOSIT_PAYMENT, reject -> kembali dengan alasan
 */
const verifyMou = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, rejection_reason } = req.body;
  const profile = await OwnerProfile.findByPk(id, {
    include: [{ model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  if (profile.status !== OWNER_STATUS.PENDING_MOU_APPROVAL) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai' });
  }

  if (approved === false) {
    await profile.update({
      status: OWNER_STATUS.REJECTED,
      mou_rejected_reason: rejection_reason
    });
    return res.json({ success: true, message: 'MoU ditolak', data: { owner_status: profile.status } });
  }

  await profile.update({ status: OWNER_STATUS.PENDING_DEPOSIT_PAYMENT });
  res.json({
    success: true,
    message: 'MoU disetujui. Owner dapat melakukan transfer deposit.',
    data: { owner_status: OWNER_STATUS.PENDING_DEPOSIT_PAYMENT }
  });
});

/**
 * PATCH /api/v1/owners/:id/verify-registration-payment (Admin Pusat / Super Admin)
 * Verifikasi bukti bayar pendaftaran (hanya Owner MOU): setujui → DEPOSIT_VERIFIED, tolak → REJECTED.
 * Owner Non-MOU tidak perlu langkah ini; gunakan Aktivasi Akun langsung.
 */
const verifyRegistrationPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved, rejection_reason } = req.body;
  const profile = await OwnerProfile.findByPk(id, {
    include: [{ model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name', 'role'] }]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  if (profile.User?.role === ROLES.OWNER_NON_MOU) {
    return res.status(400).json({ success: false, message: 'Owner Non-MOU tidak perlu verifikasi bukti bayar. Gunakan menu Aktivasi Akun.' });
  }
  if (profile.status !== OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai. Hanya owner yang sudah upload bukti bayar pendaftaran yang dapat diverifikasi.' });
  }

  if (approved === false) {
    await profile.update({
      status: OWNER_STATUS.REJECTED,
      mou_rejected_reason: rejection_reason
    });
    return res.json({ success: true, message: 'Bukti bayar pendaftaran ditolak.', data: { owner_status: profile.status } });
  }

  await profile.update({
    status: OWNER_STATUS.DEPOSIT_VERIFIED,
    registration_payment_verified_at: new Date(),
    registration_payment_verified_by: req.user.id
  });
  res.json({
    success: true,
    message: 'Bukti bayar pendaftaran disetujui. Tetapkan cabang lalu aktivasi owner.',
    data: { owner_status: OWNER_STATUS.DEPOSIT_VERIFIED }
  });
});

/**
 * PATCH /api/v1/owners/:id/verify-deposit (Admin Pusat / Admin Cabang)
 */
const verifyDeposit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profile = await OwnerProfile.findByPk(id);
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  if (profile.status !== OWNER_STATUS.PENDING_DEPOSIT_VERIFICATION) {
    return res.status(400).json({ success: false, message: 'Status tidak sesuai' });
  }

  await profile.update({
    status: OWNER_STATUS.DEPOSIT_VERIFIED,
    deposit_verified_at: new Date(),
    deposit_verified_by: req.user.id
  });
  res.json({ success: true, message: 'Deposit terverifikasi', data: { owner_status: profile.status } });
});

/**
 * PATCH /api/v1/owners/:id/assign-branch (Admin Pusat / Admin Koordinator hanya ke cabang di wilayah)
 */
const assignBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { branch_id } = req.body;
  const profile = await OwnerProfile.findByPk(id, { include: [{ model: User, as: 'User', attributes: ['role'] }] });
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  const userRole = profile.User?.role;
  const isNonMou = userRole === ROLES.OWNER_NON_MOU;
  const allowedStatus = isNonMou
    ? [OWNER_STATUS.DEPOSIT_VERIFIED, OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION]
    : [OWNER_STATUS.DEPOSIT_VERIFIED];
  if (!allowedStatus.includes(profile.status)) {
    return res.status(400).json({ success: false, message: isNonMou ? 'Status tidak sesuai' : 'Deposit harus terverifikasi dulu' });
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
    status: OWNER_STATUS.ASSIGNED_TO_BRANCH
  });
  res.json({ success: true, message: 'Cabang berhasil ditetapkan', data: { owner_status: OWNER_STATUS.ASSIGNED_TO_BRANCH } });
});

/**
 * PATCH /api/v1/owners/:id (Admin Pusat / Super Admin)
 * Update profil owner: is_mou_owner (untuk diskon harga produk). :id = OwnerProfile.id.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_mou_owner } = req.body;
  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Hanya Admin Pusat / Super Admin yang dapat mengubah profil owner' });
  }
  const profile = await OwnerProfile.findByPk(id);
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  if (typeof is_mou_owner === 'boolean') await profile.update({ is_mou_owner });
  res.json({ success: true, data: profile });
});

/**
 * PATCH /api/v1/owners/:id/activate (Admin Pusat / Admin Koordinator wilayah)
 * Generate password baru, update user (password lama tidak berlaku), generate MOU PDF, set ACTIVE.
 * Body: is_mou_owner (optional) - set true/false saat aktivasi.
 */
const activate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_mou_owner: bodyIsMou } = req.body || {};
  const profile = await OwnerProfile.findByPk(id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'email', 'name', 'phone', 'company_name', 'role'] },
      { model: Branch, as: 'AssignedBranch', attributes: ['id', 'name', 'code'], required: false },
      { model: Branch, as: 'PreferredBranch', attributes: ['id', 'name', 'code'], required: false }
    ]
  });
  if (!profile) return res.status(404).json({ success: false, message: 'Owner tidak ditemukan' });
  const userRole = profile.User?.role;
  const isNonMou = userRole === ROLES.OWNER_NON_MOU;
  const canActivate = [OWNER_STATUS.ASSIGNED_TO_BRANCH, OWNER_STATUS.DEPOSIT_VERIFIED].includes(profile.status)
    || (isNonMou && profile.status === OWNER_STATUS.PENDING_REGISTRATION_VERIFICATION);
  if (!canActivate) {
    return res.status(400).json({ success: false, message: 'Owner harus sudah verifikasi bukti bayar (MOU) atau langsung aktivasi (Non-MOU).' });
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN_PUSAT) {
    if (isKoordinatorRole(req.user.role)) {
      const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
      const branchId = profile.assigned_branch_id || profile.preferred_branch_id;
      if (!branchId || !branchIds.includes(branchId)) {
        return res.status(403).json({ success: false, message: 'Owner ini bukan di wilayah Anda.' });
      }
    } else if (profile.assigned_branch_id !== req.user.branch_id) {
      return res.status(403).json({ success: false, message: 'Bukan cabang Anda' });
    }
  }

  const newPassword = crypto.randomBytes(8).toString('base64').replace(/[+/=]/g, (m) => ({ '+': '', '/': '', '=': '' }[m] || m)).slice(0, 12) || crypto.randomBytes(6).toString('hex');
  const user = profile.User;
  if (!user) return res.status(500).json({ success: false, message: 'Data user owner tidak ditemukan' });

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);
  await User.update({ password_hash }, { where: { id: user.id } });

  let mou_generated_url = null;
  let emailSent = false;

  if (!isNonMou) {
    const assignedBranchName = (profile.AssignedBranch && profile.AssignedBranch.name) || (profile.PreferredBranch && profile.PreferredBranch.name) || (profile.preferred_branch_id ? (await Branch.findByPk(profile.preferred_branch_id, { attributes: ['name'] }))?.name : null) || 'Cabang Bintang Global';
    mou_generated_url = await generateMouPdf({
      user: user.get ? user.get({ plain: true }) : user,
      ownerProfile: profile.get ? profile.get({ plain: true }) : profile,
      newPassword,
      assignedBranchName
    });
    const mouDir = uploadConfig.getDir(uploadConfig.SUBDIRS.MOU);
    const mouFilePath = path.join(mouDir, path.basename(mou_generated_url));
    emailSent = await sendMouToOwner(user.email, user.name, newPassword, mouFilePath);
  }

  const activatePayload = {
    status: OWNER_STATUS.ACTIVE,
    activated_at: new Date(),
    activated_by: req.user.id,
    mou_generated_url,
    assigned_branch_id: profile.assigned_branch_id || profile.preferred_branch_id,
    activation_generated_password: newPassword
  };
  if (typeof bodyIsMou === 'boolean') activatePayload.is_mou_owner = bodyIsMou;
  await profile.update(activatePayload);
  await User.update(
    { branch_id: profile.assigned_branch_id || profile.preferred_branch_id },
    { where: { id: user.id } }
  );

  if (isNonMou) {
    res.json({
      success: true,
      message: 'Owner Non-MOU berhasil diaktifkan. Berikan password baru kepada owner (tidak ada surat MOU).',
      data: {
        owner_status: OWNER_STATUS.ACTIVE,
        user_id: user.id,
        generated_password: newPassword,
        mou_generated_url: null,
        email_sent: false
      }
    });
    return;
  }

  res.json({
    success: true,
    message: emailSent
      ? 'Owner berhasil diaktifkan. Email berisi MOU dan password baru telah dikirim ke email owner.'
      : 'Owner berhasil diaktifkan. Password baru dan MOU telah digenerate. Email tidak terkirim (periksa konfigurasi SMTP). Berikan password dan link MOU kepada owner.',
    data: {
      owner_status: OWNER_STATUS.ACTIVE,
      user_id: user.id,
      generated_password: newPassword,
      mou_generated_url,
      email_sent: emailSent
    }
  });
});

/** Resolve URL path (/uploads/registration-payment/xxx) ke path absolut file */
function resolveRegistrationPaymentPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const norm = urlPath.replace(/\\/g, '/').trim().replace(/^\/+/, '');
  const withoutUploads = norm.replace(/^uploads\/?/i, '');
  const dir = uploadConfig.getDir(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT);
  const filename = path.basename(withoutUploads);
  if (!filename) return null;
  return path.join(dir, filename);
}

/** Resolve URL path (/uploads/mou/xxx) ke path absolut file */
function resolveMouPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const norm = urlPath.replace(/\\/g, '/').trim().replace(/^\/+/, '');
  const withoutUploads = norm.replace(/^uploads\/?/i, '');
  const dir = uploadConfig.getDir(uploadConfig.SUBDIRS.MOU);
  const filename = path.basename(withoutUploads);
  if (!filename) return null;
  return path.join(dir, filename);
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

/**
 * GET /api/v1/owners/:id/registration-payment-file
 * Stream file bukti bayar pendaftaran (agar tidak 404 saat nginx/static path beda).
 * Akses: Admin/Koordinator untuk user id, atau owner untuk id sendiri.
 */
const getRegistrationPaymentFile = asyncHandler(async (req, res) => {
  const ownerId = req.params.id === 'me' ? req.user.id : req.params.id;
  const profile = await OwnerProfile.findOne({
    where: { user_id: ownerId },
    attributes: ['id', 'user_id', 'registration_payment_proof_url']
  });
  if (!profile || !profile.registration_payment_proof_url) {
    return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  }
  const canAccess = req.params.id === 'me'
    ? req.user.id === ownerId
    : req.user.id === ownerId || [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR].includes(req.user.role);
  if (!canAccess) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  const filePath = resolveRegistrationPaymentPath(profile.registration_payment_proof_url);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada di server' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const downloadName = path.basename(filePath);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${downloadName.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/v1/owners/:id/mou-file?type=generated|signed
 * Stream file MOU (generated at activation or signed upload) so nginx/static 404 is avoided.
 * type=generated (default) -> mou_generated_url, type=signed -> mou_signed_url.
 */
const getMouFile = asyncHandler(async (req, res) => {
  const isMe = req.params.id === 'me' || req.params.id == null;
  const ownerId = isMe ? (req.user && req.user.id) : req.params.id;
  if (!ownerId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const type = (req.query.type || 'generated').toLowerCase() === 'signed' ? 'signed' : 'generated';
  const profile = await OwnerProfile.findOne({
    where: { user_id: ownerId },
    attributes: ['id', 'user_id', 'mou_generated_url', 'mou_signed_url']
  });
  const urlPath = type === 'signed' ? profile?.mou_signed_url : profile?.mou_generated_url;
  if (!profile || !urlPath) {
    return res.status(404).json({ success: false, message: 'File MOU tidak ditemukan' });
  }
  const canAccess = isMe
    ? req.user && req.user.id === ownerId
    : req.user && (req.user.id === ownerId || [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR].includes(req.user.role));
  if (!canAccess) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  const filePath = resolveMouPath(urlPath);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ada di server' });
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const downloadName = path.basename(filePath);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${downloadName.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = {
  register,
  uploadRegistrationPayment,
  uploadMou,
  getMyProfile,
  getMyBalance,
  getBalanceForUser,
  getRegistrationPaymentFile,
  getMouFile,
  getStats,
  list,
  getById,
  updateProfile,
  verifyMou,
  verifyRegistrationPayment,
  verifyDeposit,
  assignBranch,
  activate
};
