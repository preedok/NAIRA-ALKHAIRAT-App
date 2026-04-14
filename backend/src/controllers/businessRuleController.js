const { BusinessRuleConfig } = require('../models');

async function getPublic(_req, res) {
  const rows = await BusinessRuleConfig.findAll({ where: { branch_id: null }, raw: true });
  const data = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json({ success: true, data });
}

async function get(req, res) {
  return getPublic(req, res);
}

async function set(req, res) {
  const updates = req.body || {};
  for (const [key, value] of Object.entries(updates)) {
    // eslint-disable-next-line no-await-in-loop
    await BusinessRuleConfig.upsert({ key, value, branch_id: null, updated_by: req.user.id });
  }
  res.json({ success: true, message: 'Pengaturan diperbarui' });
}

module.exports = { getPublic, get, set };
