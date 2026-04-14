const { Invoice } = require('../models');

async function list(req, res) {
  const where = req.user?.canonical_role === 'user' ? { owner_id: req.user.id } : {};
  const rows = await Invoice.findAll({ where, order: [['created_at', 'DESC']] });
  res.json({ success: true, data: rows });
}

async function getById(req, res) {
  const row = await Invoice.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  res.json({ success: true, data: row });
}

async function create(req, res) {
  const row = await Invoice.create(req.body);
  res.status(201).json({ success: true, data: row });
}

const ok = async (_req, res) => res.json({ success: true });
const empty = async (_req, res) => res.json({ success: true, data: [] });

module.exports = {
  list,
  getById,
  create,
  getSummary: empty,
  listReallocations: empty,
  listDraftOrders: empty,
  exportListPdf: ok,
  getPdf: ok,
  getArchive: ok,
  getStatusHistory: empty,
  getOrderRevisions: empty,
  getTicketFile: ok,
  getVisaFile: ok,
  getSiskopatuhFile: ok,
  getHajiDakhiliFile: ok,
  getManifestFile: ok,
  unblock: ok,
  verifyPayment: ok,
  handleOverpaid: ok,
  allocateBalance: ok
};
