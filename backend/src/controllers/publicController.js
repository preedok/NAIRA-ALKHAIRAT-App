const { Product } = require('../models');

async function listProductsForSearch(_req, res) {
  const rows = await Product.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'description'],
    order: [['created_at', 'DESC']]
  });
  res.json({ success: true, data: rows });
}

module.exports = { listProductsForSearch };
