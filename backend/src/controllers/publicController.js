const { Product, Branch, Province, Wilayah } = require('../models');

async function listProductsForSearch(_req, res) {
  const rows = await Product.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'description'],
    order: [['created_at', 'DESC']]
  });
  res.json({ success: true, data: rows });
}

async function listBranches(_req, res) {
  const rows = await Branch.findAll({
    attributes: ['id', 'name', 'province_id', 'wilayah_id'],
    include: [
      { model: Province, as: 'Province', attributes: ['id', 'name'], required: false },
      { model: Wilayah, as: 'Wilayah', attributes: ['id', 'name', 'province_id'], required: false }
    ],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: rows });
}

async function listProvinces(_req, res) {
  const rows = await Province.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: rows });
}

async function listWilayahs(req, res) {
  const provinceId = req.query.province_id;
  if (!provinceId) {
    return res.status(400).json({ success: false, message: 'Parameter province_id wajib' });
  }
  const rows = await Wilayah.findAll({
    where: { province_id: provinceId },
    attributes: ['id', 'name', 'province_id'],
    order: [['name', 'ASC']]
  });
  res.json({ success: true, data: rows });
}

module.exports = { listProductsForSearch, listBranches, listProvinces, listWilayahs };
