const { Order, OrderItem } = require('../models');

async function list(req, res) {
  const where = req.user?.canonical_role === 'user' ? { owner_id: req.user.id } : {};
  const rows = await Order.findAll({ where, include: [{ model: OrderItem, as: 'OrderItems' }], order: [['created_at', 'DESC']] });
  res.json({ success: true, data: rows });
}

async function create(req, res) {
  const payload = { ...req.body };
  if (req.user?.canonical_role === 'user') payload.owner_id = req.user.id;
  const row = await Order.create(payload);
  res.status(201).json({ success: true, data: row });
}

async function getById(req, res) {
  const row = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'OrderItems' }] });
  if (!row) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  res.json({ success: true, data: row });
}

async function update(req, res) {
  const row = await Order.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  await row.update(req.body);
  res.json({ success: true, data: row });
}

async function destroy(req, res) {
  const row = await Order.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  await row.destroy();
  res.json({ success: true, message: 'Order dihapus' });
}

async function uploadJamaahData(_req, res) {
  res.json({ success: true, message: 'Upload data jamaah tersimpan' });
}

async function createOrderCancellationRequest(_req, res) {
  res.json({ success: true, message: 'Permintaan pembatalan diterima' });
}

async function sendOrderResult(_req, res) {
  res.json({ success: true, message: 'Hasil order terkirim' });
}

module.exports = {
  list,
  create,
  getById,
  update,
  destroy,
  uploadJamaahData,
  createOrderCancellationRequest,
  sendOrderResult
};
