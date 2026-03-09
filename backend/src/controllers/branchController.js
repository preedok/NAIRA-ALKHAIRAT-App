/**
 * Branch & master lokasi (wilayah, provinsi, kabupaten/kota).
 * Semua data wilayah, provinsi, kabupaten/kota dari database master saja (tabel wilayah, provinsi, kabupaten).
 * Isi master: migration 20250217000004 (wilayah + provinsi), seeder seed:kabupaten (kabupaten/kota).
 * Utility locationMaster: generate otomatis provinsi/wilayah dari kota (kode kabupaten) dan sebaliknya.
 */
const asyncHandler = require('express-async-handler');
const { Branch, Wilayah, Provinsi, Kabupaten } = require('../models');
const { ROLES } = require('../constants');
const { Op } = require('sequelize');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const { resolveFromKota, enrichBranchWithLocation } = require('../utils/locationMaster');

const ALLOWED_SORT = ['code', 'name', 'city', 'region', 'manager_name', 'is_active', 'created_at'];

/** GET /branches/provinces — data dari tabel provinsi (master DB). */
const listProvinces = asyncHandler(async (req, res) => {
  const { wilayah_id: qWilayahId } = req.query;
  const where = {};
  if (qWilayahId && String(qWilayahId).trim() !== '') {
    const sel = await Wilayah.findByPk(qWilayahId.trim(), { attributes: ['id', 'name'] });
    if (sel && sel.name) {
      const allWilayah = await Wilayah.findAll({ attributes: ['id', 'name'], raw: true });
      const nameKey = (sel.name || '').trim().toLowerCase();
      const ids = (allWilayah || []).filter((w) => (w.name || '').trim().toLowerCase() === nameKey).map((w) => w.id);
      if (ids.length > 0) where.wilayah_id = { [Op.in]: ids };
    } else {
      where.wilayah_id = qWilayahId.trim();
    }
  }
  const provinsi = await Provinsi.findAll({
    where,
    attributes: ['id', 'kode', 'name', 'wilayah_id'],
    include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }],
    order: [['kode', 'ASC']]
  });
  const data = provinsi.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.name,
    name: p.name,
    wilayah_id: p.wilayah_id,
    wilayah: p.Wilayah ? p.Wilayah.name : null
  }));
  res.json({ success: true, data });
});

/** GET /branches/wilayah — data dari tabel wilayah (master DB). */
const listWilayah = asyncHandler(async (req, res) => {
  const wilayah = await Wilayah.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  // Dedupe by name (nama sama cukup tampil sekali; pakai id pertama yang ketemu)
  const byName = new Map();
  wilayah.forEach((w) => {
    const key = (w.name || '').trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, { id: w.id, name: w.name || '' });
  });
  const data = Array.from(byName.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json({ success: true, data });
});

/** GET /branches/kabupaten/:provinceId — data dari tabel kabupaten (master DB). */
const listKabupaten = asyncHandler(async (req, res) => {
  const { provinceId } = req.params;
  if (!provinceId) return res.status(400).json({ success: false, message: 'Province ID required' });
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(String(provinceId).trim());
  let provinsiId = isUuid ? provinceId : null;
  let kode = isUuid ? null : provinceId;
  let provinsiName = null;
  if (isUuid) {
    const prov = await Provinsi.findByPk(provinceId, { attributes: ['id', 'kode', 'name'] });
    if (!prov) return res.status(404).json({ success: false, message: 'Provinsi tidak ditemukan' });
    provinsiId = prov.id;
    kode = prov.kode;
    provinsiName = prov.name;
  } else {
    const prov = await Provinsi.findOne({ where: { kode: provinceId }, attributes: ['id', 'kode', 'name'] });
    if (prov) {
      provinsiId = prov.id;
      provinsiName = prov.name;
    }
  }
  let provinsiIds = provinsiId ? [provinsiId] : [];
  if (provinsiId && provinsiName) {
    const allProv = await Provinsi.findAll({ attributes: ['id', 'name'], raw: true });
    const nameKey = (provinsiName || '').trim().toLowerCase();
    provinsiIds = (allProv || []).filter((p) => (p.name || '').trim().toLowerCase() === nameKey).map((p) => p.id);
  }
  let data = [];
  if (provinsiIds.length > 0) {
    const fromDb = await Kabupaten.findAll({
      where: { provinsi_id: { [Op.in]: provinsiIds } },
      attributes: ['id', 'kode', 'nama'],
      order: [['kode', 'ASC']]
    });
    data = fromDb.map((k) => ({ id: k.id, kode: k.kode, nama: k.nama, name: k.nama }));
  }
  res.json({ success: true, data });
});

/**
 * GET /branches/kabupaten-for-owner
 * Returns all kabupaten with provinsi_id, provinsi_nama, wilayah_id, wilayah_nama for Add User (owner) dropdown.
 * Data dari master kabupaten di DB saja (isi via seeder seed:kabupaten).
 */
const listKabupatenForOwner = asyncHandler(async (req, res) => {
  const fromDb = await Kabupaten.findAll({
    attributes: ['id', 'kode', 'nama', 'provinsi_id'],
    include: [{
      model: Provinsi,
      as: 'Provinsi',
      attributes: ['id', 'name', 'wilayah_id'],
      required: true,
      include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }]
    }],
    order: [['kode', 'ASC']]
  });
  const result = fromDb.length > 0
    ? fromDb.map((k) => ({
        id: k.id,
        kode: k.kode,
        nama: k.nama,
        provinsi_id: k.Provinsi.id,
        provinsi_nama: k.Provinsi.name,
        wilayah_id: k.Provinsi.wilayah_id,
        wilayah_nama: k.Provinsi.Wilayah ? k.Provinsi.Wilayah.name : null
      }))
    : [];
  res.json({ success: true, data: result });
});

const listPublic = asyncHandler(async (req, res) => {
  const { search, region, limit = 500 } = req.query;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);
  const where = { is_active: true };
  if (region) where.region = region;
  if (search && typeof search === 'string' && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { code: { [Op.iLike]: q } },
      { city: { [Op.iLike]: q } },
      { region: { [Op.iLike]: q } }
    ];
  }
  const rows = await Branch.findAll({
    where,
    attributes: ['id', 'code', 'name', 'city', 'region', 'koordinator_provinsi', 'koordinator_provinsi_phone', 'koordinator_provinsi_email', 'koordinator_wilayah', 'koordinator_wilayah_phone', 'koordinator_wilayah_email'],
    order: [['region', 'ASC'], ['name', 'ASC']],
    limit: lim
  });
  res.json({ success: true, data: rows });
});

const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];

const list = asyncHandler(async (req, res) => {
  const { limit = 25, page = 1, include_inactive, search, region, provinsi_id, wilayah_id: qWilayahId, city, is_active, sort_by, sort_order } = req.query;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  let wilayah_id = qWilayahId;
  if (KOORDINATOR_ROLES.includes(req.user?.role) && req.user?.wilayah_id) {
    wilayah_id = req.user.wilayah_id;
  }

  const where = {};
  if (is_active === 'true' || is_active === '1') where.is_active = true;
  else if (is_active === 'false' || is_active === '0') where.is_active = false;
  else if (include_inactive !== 'true' && include_inactive !== '1') where.is_active = true;
  if (region) where.region = region;
  if (provinsi_id) where.provinsi_id = provinsi_id;
  if (city && typeof city === 'string' && city.trim()) where.city = { [Op.iLike]: `%${city.trim()}%` };
  if (search && typeof search === 'string' && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { code: { [Op.iLike]: q } },
      { city: { [Op.iLike]: q } },
      { region: { [Op.iLike]: q } }
    ];
  }

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'code';
  const sortDir = (sort_order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (wilayah_id) {
    const branchIdsInWilayah = await getBranchIdsForWilayah(wilayah_id);
    if (branchIdsInWilayah.length > 0) {
      where.id = { [Op.in]: branchIdsInWilayah };
    } else {
      where.id = { [Op.in]: [] };
    }
  }

  const includeOpt = [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }];
  const { count, rows } = await Branch.findAndCountAll({
    where,
    include: includeOpt,
    order: [[sortCol, sortDir]],
    limit: lim,
    offset,
    distinct: true
  });
  const totalPages = Math.ceil(count / lim) || 1;
  const data = await Promise.all(rows.map(async (row) => {
    const plain = row.toJSON ? row.toJSON() : { ...row };
    const loc = await enrichBranchWithLocation(row, { syncDb: true });
    return { ...plain, provinsi_name: loc.provinsi_name, wilayah_name: loc.wilayah_name, provinsi_id: loc.provinsi_id || plain.provinsi_id, wilayah_id: loc.wilayah_id };
  }));
  res.json({
    success: true,
    data,
    pagination: { total: count, page: pg, limit: lim, totalPages }
  });
});

/**
 * GET /branches/location-by-kota
 * Resolve lokasi lengkap (kabupaten, provinsi, wilayah) dari kode kota atau id kabupaten.
 * Untuk modul yang perlu generate otomatis provinsi/wilayah ketika data kota ada.
 * Query: kode (kode kabupaten, e.g. 3201) atau id (UUID kabupaten)
 */
const getLocationByKota = asyncHandler(async (req, res) => {
  const kode = req.query.kode || req.query.id;
  if (!kode || String(kode).trim() === '') {
    return res.status(400).json({ success: false, message: 'Query kode atau id diperlukan' });
  }
  const resolved = await resolveFromKota(String(kode).trim());
  if (!resolved) {
    return res.status(404).json({ success: false, message: 'Kota/kabupaten tidak ditemukan di master' });
  }
  res.json({
    success: true,
    data: {
      kabupaten: resolved.kabupaten,
      provinsi: resolved.provinsi,
      wilayah: resolved.wilayah
    }
  });
});

module.exports = {
  listPublic,
  list,
  listProvinces,
  listWilayah,
  listKabupaten,
  listKabupatenForOwner,
  getLocationByKota
};
