const bcrypt = require('bcryptjs');
const { AppSetting, MaintenanceNotice, User, SystemLog, Branch, Province, Wilayah } = require('../models');
const { normalizeRole, ROLES, isAdminPusatRole, isAdminCabangRole } = require('../constants');

async function getI18n(req, res) {
  const locale = req.params.locale || 'id';
  res.json({ success: true, data: { locale, app_name: 'Platform Umroh B2C', dashboard: 'Dashboard' } });
}

async function getSettings(_req, res) {
  const rows = await AppSetting.findAll({ raw: true });
  const data = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json({ success: true, data });
}

async function updateSettings(req, res) {
  const updates = req.body || {};
  for (const [key, value] of Object.entries(updates)) {
    // eslint-disable-next-line no-await-in-loop
    await AppSetting.upsert({ key, value });
  }
  res.json({ success: true, message: 'Settings diperbarui' });
}

async function getActiveMaintenance(_req, res) {
  const data = await MaintenanceNotice.findAll({ where: { is_active: true }, order: [['created_at', 'DESC']] });
  res.json({ success: true, block_app: false, data, upcoming: data });
}

async function listMaintenance(_req, res) {
  const data = await MaintenanceNotice.findAll({ order: [['created_at', 'DESC']] });
  res.json({ success: true, data });
}

async function createMaintenance(req, res) {
  const row = await MaintenanceNotice.create({ ...req.body, created_by: req.user.id });
  res.status(201).json({ success: true, data: row });
}

async function updateMaintenance(req, res) {
  const row = await MaintenanceNotice.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Maintenance tidak ditemukan' });
  await row.update(req.body);
  res.json({ success: true, data: row });
}

async function deleteMaintenance(req, res) {
  const row = await MaintenanceNotice.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Maintenance tidak ditemukan' });
  await row.destroy();
  res.json({ success: true, message: 'Maintenance dihapus' });
}

async function getMonitoring(_req, res) {
  const totalUsers = await User.count();
  res.json({ success: true, data: { total_users: totalUsers } });
}

async function getUsersStatus(_req, res) {
  const where = {};
  const myRole = normalizeRole(_req.user?.role);
  if (isAdminCabangRole(myRole)) where.branch_id = _req.user.branch_id || null;
  const data = await User.findAll({
    where,
    attributes: ['id', 'name', 'email', 'role', 'is_active', 'branch_id', 'phone', 'created_at'],
    include: [{
      model: Branch,
      as: 'Branch',
      attributes: ['id', 'name', 'province_id', 'wilayah_id'],
      required: false,
      include: [
        { model: Province, as: 'Province', attributes: ['id', 'name'], required: false },
        { model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }
      ]
    }],
    order: [['created_at', 'DESC']],
    limit: 200
  });
  res.json({ success: true, data });
}

const branchIncludeGeo = [
  { model: Province, as: 'Province', attributes: ['id', 'name'], required: false },
  { model: Wilayah, as: 'Wilayah', attributes: ['id', 'name', 'province_id'], required: false }
];

async function assertWilayahMatchesProvince(provinceId, wilayahId) {
  if (!provinceId || !wilayahId) return { ok: false, message: 'Provinsi dan wilayah wajib dipilih' };
  const wilayah = await Wilayah.findByPk(wilayahId);
  if (!wilayah || wilayah.province_id !== provinceId) {
    return { ok: false, message: 'Wilayah tidak sesuai dengan provinsi' };
  }
  return { ok: true };
}

async function listBranches(req, res) {
  const role = normalizeRole(req.user?.role);
  if (isAdminCabangRole(role)) {
    const branch = req.user?.branch_id
      ? await Branch.findByPk(req.user.branch_id, { include: branchIncludeGeo })
      : null;
    return res.json({ success: true, data: branch ? [branch] : [] });
  }
  const data = await Branch.findAll({
    attributes: ['id', 'name', 'province_id', 'wilayah_id'],
    include: branchIncludeGeo,
    order: [['name', 'ASC']]
  });
  return res.json({ success: true, data });
}

async function createBranch(req, res) {
  if (!isAdminPusatRole(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Hanya admin pusat yang bisa membuat cabang' });
  }
  const name = String(req.body?.name || '').trim();
  const province_id = req.body?.province_id || null;
  const wilayah_id = req.body?.wilayah_id || null;
  if (!name) return res.status(400).json({ success: false, message: 'Nama cabang wajib diisi' });
  const geo = await assertWilayahMatchesProvince(province_id, wilayah_id);
  if (!geo.ok) return res.status(400).json({ success: false, message: geo.message });
  const row = await Branch.create({ name, province_id, wilayah_id });
  const full = await Branch.findByPk(row.id, { include: branchIncludeGeo });
  return res.status(201).json({ success: true, data: full });
}

async function updateBranch(req, res) {
  if (!isAdminPusatRole(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Hanya admin pusat yang bisa mengubah cabang' });
  }
  const row = await Branch.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Nama cabang wajib diisi' });
  let province_id = row.province_id;
  let wilayah_id = row.wilayah_id;
  const touchesGeo = req.body?.province_id !== undefined || req.body?.wilayah_id !== undefined;
  if (touchesGeo) {
    const p = req.body?.province_id !== undefined ? (req.body.province_id || null) : row.province_id;
    const w = req.body?.wilayah_id !== undefined ? (req.body.wilayah_id || null) : row.wilayah_id;
    if (!p || !w) {
      return res.status(400).json({ success: false, message: 'Provinsi dan wilayah wajib dipilih berpasangan' });
    }
    const geo = await assertWilayahMatchesProvince(p, w);
    if (!geo.ok) return res.status(400).json({ success: false, message: geo.message });
    province_id = p;
    wilayah_id = w;
  }
  await row.update({ name, province_id, wilayah_id });
  const full = await Branch.findByPk(row.id, { include: branchIncludeGeo });
  return res.json({ success: true, data: full });
}

async function createUser(req, res) {
  const actorRole = normalizeRole(req.user?.role);
  const { name, email, password, role, branch_id, phone } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Nama, email, password, role wajib diisi' });
  }
  const targetRole = normalizeRole(role);
  if (targetRole === ROLES.ADMIN_PUSAT && !isAdminPusatRole(actorRole)) {
    return res.status(403).json({ success: false, message: 'Hanya admin pusat yang dapat membuat admin pusat' });
  }
  if (targetRole === ROLES.ADMIN_CABANG && !isAdminPusatRole(actorRole)) {
    return res.status(403).json({ success: false, message: 'Hanya admin pusat yang dapat membuat admin cabang' });
  }
  if (targetRole === ROLES.JAMAAH && !(isAdminPusatRole(actorRole) || isAdminCabangRole(actorRole))) {
    return res.status(403).json({ success: false, message: 'Role tidak diizinkan membuat jamaah' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await User.findOne({ where: { email: normalizedEmail } });
  if (exists) return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });

  let finalBranchId = branch_id || null;
  if (isAdminCabangRole(actorRole)) {
    finalBranchId = req.user.branch_id || null;
  }
  if ((targetRole === ROLES.ADMIN_CABANG || targetRole === ROLES.JAMAAH) && !finalBranchId) {
    return res.status(400).json({ success: false, message: 'branch_id wajib untuk admin cabang / jamaah' });
  }
  const password_hash = await bcrypt.hash(String(password), 10);
  let wilayah_id = null;
  if (finalBranchId) {
    const b = await Branch.findByPk(finalBranchId);
    if (b) wilayah_id = b.wilayah_id;
  }
  const row = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : null,
    role: targetRole,
    branch_id: finalBranchId,
    wilayah_id,
    password_hash,
    is_active: true
  });
  const data = row.toJSON();
  delete data.password_hash;
  return res.status(201).json({ success: true, data });
}

async function getLogs(_req, res) {
  const data = await SystemLog.findAll({ order: [['created_at', 'DESC']], limit: 100 });
  res.json({ success: true, data });
}

async function createLog(req, res) {
  const row = await SystemLog.create({ source: 'admin', level: req.body.level || 'info', message: req.body.message || '', meta: req.body.meta || {} });
  res.status(201).json({ success: true, data: row });
}

const okExport = async (_req, res) => res.json({ success: true, message: 'Export siap diproses' });

module.exports = {
  getI18n,
  getSettings,
  updateSettings,
  getActiveMaintenance,
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getMonitoring,
  getUsersStatus,
  listBranches,
  createBranch,
  updateBranch,
  createUser,
  getLogs,
  createLog,
  exportMonitoringExcel: okExport,
  exportMonitoringPdf: okExport,
  exportLogsExcel: okExport,
  exportLogsPdf: okExport
};
