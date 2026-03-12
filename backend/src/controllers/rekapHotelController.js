const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { RekapHotel } = require('../models');

/**
 * GET /api/v1/rekap-hotel
 * List dengan filter: period_name, time_range (semua|hari_ini|2_hari|...|sebulan), search.
 */
function getTimeRangeDates(timeRange) {
  if (!timeRange || timeRange === 'semua') return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const toYMD = (d) => d.toISOString().slice(0, 10);
  const start = toYMD(today);
  let endDate = new Date(today);
  const days = {
    hari_ini: 0,
    '2_hari': 2,
    '3_hari': 3,
    '4_hari': 4,
    '5_hari': 5,
    '6_hari': 6,
    '7_hari': 7,
    seminggu: 7,
    dua_minggu: 14,
    tiga_minggu: 21,
    sebulan: 30
  };
  const add = days[timeRange];
  if (add == null) return null;
  endDate.setUTCDate(endDate.getUTCDate() + add);
  return { start, end: toYMD(endDate) };
}

function normalizeRekapRow(r) {
  const row = r.get ? r.get({ plain: true }) : { ...r };
  const bools = ['meal_bb', 'meal_fb', 'status_available', 'status_booked', 'status_amend', 'status_lunas'];
  bools.forEach((k) => { if (row[k] == null) row[k] = false; });
  if (row.voucher == null) row.voucher = '';
  if (row.keterangan == null) row.keterangan = '';
  if (row.invoice_clerk == null) row.invoice_clerk = '';
  return row;
}

const list = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    period_name,
    year_month,
    time_range,
    paket_type,
    bandara,
    search,
    sort_by = 'sort_order',
    sort_order = 'ASC'
  } = req.query;

  const pg = Math.max(1, parseInt(page, 10));
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pg - 1) * lim;

  const where = {};
  if (period_name && period_name.trim()) where.period_name = { [Op.iLike]: `%${period_name.trim()}%` };
  if (paket_type && paket_type.trim()) where.paket_type = { [Op.iLike]: `%${paket_type.trim()}%` };
  if (bandara && bandara.trim()) where.bandara = { [Op.iLike]: bandara.trim() };

  let monthStart = null;
  let monthEnd = null;
  if (year_month && /^\d{4}-\d{2}$/.test(String(year_month).trim())) {
    const [y, m] = String(year_month).trim().split('-');
    monthStart = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0);
    monthEnd = `${y}-${m}-${String(lastDay.getDate()).padStart(2, '0')}`;
  }

  const range = getTimeRangeDates(time_range);
  const rangeStart = range ? range.start : null;
  const rangeEnd = range ? range.end : null;

  const start = monthStart && rangeStart ? (monthStart > rangeStart ? monthStart : rangeStart) : (monthStart || rangeStart);
  const end = monthEnd && rangeEnd ? (monthEnd < rangeEnd ? monthEnd : rangeEnd) : (monthEnd || rangeEnd);
  if (start && end) {
    where.check_in = { [Op.and]: [{ [Op.gte]: start }, { [Op.lte]: end }] };
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    where[Op.or] = [
      { client: { [Op.iLike]: s } },
      { hotel_makkah: { [Op.iLike]: s } },
      { hotel_madinah: { [Op.iLike]: s } },
      { hotel_name: { [Op.iLike]: s } },
      { hotel_combo: { [Op.iLike]: s } },
      { paket: { [Op.iLike]: s } },
      { paket_label: { [Op.iLike]: s } },
      { notes: { [Op.iLike]: s } },
      { keterangan: { [Op.iLike]: s } },
      { definite: { [Op.iLike]: s } },
      { tentative: { [Op.iLike]: s } },
      { ref_number: { [Op.iLike]: s } },
      { voucher: { [Op.iLike]: s } },
      { invoice_clerk: { [Op.iLike]: s } }
    ];
  }

  const order = [[sort_by, (sort_order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'], ['created_at', 'ASC']];
  const { count, rows } = await RekapHotel.findAndCountAll({
    where,
    limit: lim,
    offset,
    order,
    distinct: true
  });

  const totalPages = Math.ceil((count || 0) / lim) || 1;
  res.json({
    success: true,
    data: rows.map(normalizeRekapRow),
    pagination: { total: count || 0, page: pg, limit: lim, totalPages }
  });
});

/**
 * GET /api/v1/rekap-hotel/options
 * Aggregasi untuk filter dropdown: period_name, season_year, location, status, paket_type, bandara.
 */
const getOptions = asyncHandler(async (req, res) => {
  const [periods, seasons, locations, statuses, paketTypes, bandaras] = await Promise.all([
    RekapHotel.findAll({ attributes: ['period_name'], where: { period_name: { [Op.ne]: null } }, group: ['period_name'], raw: true }).then(r => r.map(x => x.period_name).filter(Boolean).sort()),
    RekapHotel.findAll({ attributes: ['season_year'], where: { season_year: { [Op.ne]: null } }, group: ['season_year'], raw: true }).then(r => r.map(x => x.season_year).filter(Boolean).sort()),
    RekapHotel.findAll({ attributes: ['location'], where: { location: { [Op.ne]: null } }, group: ['location'], raw: true }).then(r => r.map(x => x.location).filter(Boolean).sort()),
    RekapHotel.findAll({ attributes: ['status'], where: { status: { [Op.ne]: null } }, group: ['status'], raw: true }).then(r => r.map(x => x.status).filter(Boolean).sort()),
    RekapHotel.findAll({ attributes: ['paket_type'], where: { paket_type: { [Op.ne]: null } }, group: ['paket_type'], raw: true }).then(r => r.map(x => x.paket_type).filter(Boolean).sort()),
    RekapHotel.findAll({ attributes: ['bandara'], where: { bandara: { [Op.ne]: null } }, group: ['bandara'], raw: true }).then(r => r.map(x => x.bandara).filter(Boolean).sort())
  ]);
  res.json({
    success: true,
    data: {
      period_names: periods,
      season_years: seasons,
      locations,
      statuses,
      paket_types: paketTypes,
      bandaras
    }
  });
});

/**
 * GET /api/v1/rekap-hotel/:id
 */
const getById = asyncHandler(async (req, res) => {
  const row = await RekapHotel.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Rekap hotel tidak ditemukan' });
  res.json({ success: true, data: normalizeRekapRow(row) });
});

/**
 * POST /api/v1/rekap-hotel
 */
const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const payload = {
    source_type: body.source_type || 'order_list',
    period_name: body.period_name || null,
    season_year: body.season_year || null,
    sort_order: body.sort_order != null ? body.sort_order : 0,
    tentative: body.tentative || null,
    definite: body.definite || null,
    client: body.client || null,
    paket: body.paket || null,
    hotel_makkah: body.hotel_makkah || null,
    hotel_madinah: body.hotel_madinah || null,
    check_in: body.check_in || null,
    check_out: body.check_out || null,
    total_hari: body.total_hari != null ? body.total_hari : null,
    room_d: body.room_d != null ? body.room_d : null,
    room_t: body.room_t != null ? body.room_t : null,
    room_q: body.room_q != null ? body.room_q : null,
    room_qn: body.room_qn != null ? body.room_qn : null,
    room_hx: body.room_hx != null ? body.room_hx : null,
    room: body.room != null ? body.room : null,
    pax: body.pax != null ? body.pax : null,
    meal_bb: body.meal_bb === true || body.meal_bb === 'true',
    meal_fb: body.meal_fb === true || body.meal_fb === 'true',
    status_available: body.status_available === true || body.status_available === 'true',
    status_booked: body.status_booked === true || body.status_booked === 'true',
    status_amend: body.status_amend === true || body.status_amend === 'true',
    status_lunas: body.status_lunas === true || body.status_lunas === 'true',
    voucher: body.voucher || null,
    invoice_clerk: body.invoice_clerk || null,
    ket: body.ket || null,
    keterangan: body.keterangan || null,
    location: body.location || null,
    hotel_name: body.hotel_name || null,
    room_7bed: body.room_7bed || null,
    room_6bed: body.room_6bed || null,
    room_quint: body.room_quint || null,
    room_quad: body.room_quad || null,
    room_triple: body.room_triple || null,
    room_double: body.room_double || null,
    total_room: body.total_room || null,
    status: body.status || null,
    ref_number: body.ref_number || null,
    hotel_combo: body.hotel_combo || null,
    bandara: body.bandara || null,
    paket_type: body.paket_type || null,
    paket_label: body.paket_label || null,
    notes: body.notes || null,
    extra_notes: Array.isArray(body.extra_notes) ? body.extra_notes : [],
    created_by: req.user?.id || null
  };
  const row = await RekapHotel.create(payload);
  res.status(201).json({ success: true, data: row });
});

/**
 * PATCH /api/v1/rekap-hotel/:id
 */
const update = asyncHandler(async (req, res) => {
  const row = await RekapHotel.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Rekap hotel tidak ditemukan' });
  const body = req.body || {};
  const allowed = [
    'source_type', 'period_name', 'season_year', 'sort_order',
    'tentative', 'definite', 'client', 'paket', 'hotel_makkah', 'hotel_madinah',
    'check_in', 'check_out', 'total_hari', 'room_d', 'room_t', 'room_q', 'room_qn', 'room_hx', 'room', 'pax',
    'meal_bb', 'meal_fb', 'status_available', 'status_booked', 'status_amend', 'status_lunas',
    'voucher', 'invoice_clerk', 'ket', 'keterangan',
    'location', 'hotel_name', 'room_7bed', 'room_6bed', 'room_quint', 'room_quad', 'room_triple', 'room_double', 'total_room',
    'status', 'ref_number', 'hotel_combo', 'bandara', 'paket_type', 'paket_label', 'notes', 'extra_notes'
  ];
  for (const key of allowed) {
    if (key in body) row[key] = body[key];
  }
  await row.save();
  res.json({ success: true, data: row });
});

/**
 * DELETE /api/v1/rekap-hotel/:id
 */
const remove = asyncHandler(async (req, res) => {
  const row = await RekapHotel.findByPk(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Rekap hotel tidak ditemukan' });
  await row.destroy();
  res.json({ success: true, message: 'Rekap hotel dihapus' });
});

/**
 * POST /api/v1/rekap-hotel/bulk
 * Bulk create (untuk import).
 */
const bulkCreate = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length > 200) return res.status(400).json({ success: false, message: 'Maksimal 200 baris per request' });
  const mapItem = (body) => ({
    source_type: body.source_type || 'order_list',
    period_name: body.period_name || null,
    season_year: body.season_year || null,
    sort_order: body.sort_order != null ? body.sort_order : 0,
    tentative: body.tentative || null,
    definite: body.definite || null,
    client: body.client || null,
    paket: body.paket || null,
    hotel_makkah: body.hotel_makkah || null,
    hotel_madinah: body.hotel_madinah || null,
    check_in: body.check_in || null,
    check_out: body.check_out || null,
    total_hari: body.total_hari != null ? body.total_hari : null,
    room_d: body.room_d != null ? body.room_d : null,
    room_t: body.room_t != null ? body.room_t : null,
    room_q: body.room_q != null ? body.room_q : null,
    room_qn: body.room_qn != null ? body.room_qn : null,
    room_hx: body.room_hx != null ? body.room_hx : null,
    room: body.room != null ? body.room : null,
    pax: body.pax != null ? body.pax : null,
    meal_bb: body.meal_bb === true || body.meal_bb === 'true',
    meal_fb: body.meal_fb === true || body.meal_fb === 'true',
    status_available: body.status_available === true || body.status_available === 'true',
    status_booked: body.status_booked === true || body.status_booked === 'true',
    status_amend: body.status_amend === true || body.status_amend === 'true',
    status_lunas: body.status_lunas === true || body.status_lunas === 'true',
    voucher: body.voucher || null,
    invoice_clerk: body.invoice_clerk || null,
    ket: body.ket || null,
    keterangan: body.keterangan || null,
    location: body.location || null,
    hotel_name: body.hotel_name || null,
    room_7bed: body.room_7bed || null,
    room_6bed: body.room_6bed || null,
    room_quint: body.room_quint || null,
    room_quad: body.room_quad || null,
    room_triple: body.room_triple || null,
    room_double: body.room_double || null,
    total_room: body.total_room || null,
    status: body.status || null,
    ref_number: body.ref_number || null,
    hotel_combo: body.hotel_combo || null,
    bandara: body.bandara || null,
    paket_type: body.paket_type || null,
    paket_label: body.paket_label || null,
    notes: body.notes || null,
    extra_notes: Array.isArray(body.extra_notes) ? body.extra_notes : [],
    created_by: req.user?.id || null
  });
  const created = await RekapHotel.bulkCreate(items.map(mapItem));
  res.status(201).json({ success: true, data: created, count: created.length });
});

module.exports = {
  list,
  getOptions,
  getById,
  create,
  update,
  remove,
  bulkCreate
};
