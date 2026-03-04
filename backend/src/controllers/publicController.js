const asyncHandler = require('express-async-handler');
const { Product } = require('../models');
const { Op } = require('sequelize');
const { BANDARA_TIKET } = require('../constants');

/**
 * GET /api/v1/public/products-for-search
 * Public (no auth). Returns product types, products (id, name, type, meta) for landing page search widget.
 * Optional query: type (filter by type), q (search by name).
 */
const listProductsForSearch = asyncHandler(async (req, res) => {
  const { type, q, limit = 200 } = req.query;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const where = { is_active: true };
  if (type && String(type).trim()) {
    const t = String(type).trim().toLowerCase();
    if (['hotel', 'visa', 'ticket', 'bus', 'handling', 'package'].includes(t)) {
      where.type = t;
    }
  }
  if (q && String(q).trim()) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${String(q).trim()}%` } },
      { code: { [Op.iLike]: `%${String(q).trim()}%` } }
    ];
  }
  const products = await Product.findAll({
    where,
    attributes: ['id', 'name', 'code', 'type', 'meta'],
    order: [['type', 'ASC'], ['name', 'ASC']],
    limit: lim,
    raw: true
  });
  const byType = {};
  products.forEach((p) => {
    if (!byType[p.type]) byType[p.type] = [];
    byType[p.type].push({
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      meta: p.meta || {}
    });
  });
  res.json({
    success: true,
    data: {
      productTypes: ['hotel', 'visa', 'ticket', 'bus', 'handling', 'package'],
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        type: p.type,
        meta: p.meta || {}
      })),
      byType,
      bandara: BANDARA_TIKET
    }
  });
});

module.exports = {
  listProductsForSearch
};
