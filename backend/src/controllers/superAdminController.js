const { AppSetting, MaintenanceNotice, User, SystemLog } = require('../models');

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
  const data = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'is_active'], order: [['created_at', 'DESC']], limit: 100 });
  res.json({ success: true, data });
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
  getLogs,
  createLog,
  exportMonitoringExcel: okExport,
  exportMonitoringPdf: okExport,
  exportLogsExcel: okExport,
  exportLogsPdf: okExport
};
