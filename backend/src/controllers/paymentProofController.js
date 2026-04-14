const { PaymentProof } = require('../models');

async function create(req, res) {
  const row = await PaymentProof.create({ ...req.body, invoice_id: req.params.id, uploaded_by: req.user.id });
  res.status(201).json({ success: true, data: row });
}

async function destroyRejected(req, res) {
  const row = await PaymentProof.findByPk(req.params.proofId);
  if (!row) return res.status(404).json({ success: false, message: 'Bukti pembayaran tidak ditemukan' });
  await row.destroy();
  res.json({ success: true, message: 'Bukti pembayaran dihapus' });
}

async function getFile(_req, res) {
  res.json({ success: true, data: { url: null } });
}

module.exports = { create, destroyRejected, getFile };
