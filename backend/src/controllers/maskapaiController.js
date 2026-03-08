const asyncHandler = require('express-async-handler');
const { Maskapai } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/maskapai - Daftar maskapai (master data untuk produk tiket)
 * Query: q (search name/code), active_only (default true)
 */
const list = asyncHandler(async (req, res) => {
  const { q, active_only } = req.query;
  const where = {};
  if (active_only !== 'false' && active_only !== '0') {
    where.is_active = true;
  }
  if (q && String(q).trim() !== '') {
    const term = `%${String(q).trim()}%`;
    where[Op.or] = [
      { code: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } }
    ];
  }
  const rows = await Maskapai.findAll({
    where,
    attributes: ['id', 'code', 'name', 'is_active'],
    order: [['name', 'ASC']]
  });
  const data = rows.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    is_active: m.is_active
  }));
  res.json({ success: true, data });
});

module.exports = { list };
