const { Product } = require('../models');

async function list(_req, res) {
  const rows = await Product.findAll({ order: [['created_at', 'DESC']] });
  res.json({ success: true, data: rows });
}

async function getById(req, res) {
  const row = await Product.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
  res.json({ success: true, data: row });
}

async function create(req, res) {
  const row = await Product.create(req.body);
  res.status(201).json({ success: true, data: row });
}

async function update(req, res) {
  const row = await Product.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
  await row.update(req.body);
  res.json({ success: true, data: row });
}

async function remove(req, res) {
  const row = await Product.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
  await row.destroy();
  res.json({ success: true, message: 'Paket dihapus' });
}

// Endpoint kompatibilitas lama -> diarahkan ke operasi dasar / respons sederhana.
const passthrough = {
  listPrices: async (_req, res) => res.json({ success: true, data: [] }),
  createPrice: async (_req, res) => res.status(201).json({ success: true }),
  updatePrice: async (_req, res) => res.json({ success: true }),
  deletePrice: async (_req, res) => res.json({ success: true }),
  createHotel: create,
  createVisa: create,
  createTicket: create,
  createBus: create,
  getTicketCalendar: async (_req, res) => res.json({ success: true, data: [] }),
  getBusCalendar: async (_req, res) => res.json({ success: true, data: [] }),
  getHotelCalendar: async (_req, res) => res.json({ success: true, data: [] }),
  getVisaCalendar: async (_req, res) => res.json({ success: true, data: [] }),
  getPrice: async (_req, res) => res.json({ success: true, data: null }),
  getAvailability: async (_req, res) => res.json({ success: true, data: null }),
  getHotelStayQuote: async (_req, res) => res.json({ success: true, data: null }),
  listHotelMonthlyPrices: async (_req, res) => res.json({ success: true, data: [] }),
  upsertHotelMonthlyPricesBulk: async (_req, res) => res.json({ success: true }),
  setTicketBandara: async (_req, res) => res.json({ success: true }),
  setTicketBandaraBulk: async (_req, res) => res.json({ success: true })
};

module.exports = { list, getById, create, update, remove, ...passthrough };
