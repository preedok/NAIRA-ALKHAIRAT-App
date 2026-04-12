const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Branch, Provinsi, Wilayah, Kabupaten } = require('../models');

/**
 * Fallback SQL jika query Sequelize tidak menemukan cabang (mis. provinsi_id null di kotas,
 * is_active, atau edge case join) — supaya filter wilayah/provinsi tetap selaras invoice di DB.
 */
async function getBranchIdsForWilayahSqlFallback(wilayahIds) {
  if (!wilayahIds || wilayahIds.length === 0) return [];
  const safe = [...new Set(wilayahIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!safe.length) return [];
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const escaped = safe.filter((id) => uuidRe.test(id));
  if (!escaped.length) return [];
  const list = escaped.map((u) => `'${u.replace(/'/g, "''")}'::uuid`).join(', ');
  const rows = await sequelize.query(
    `SELECT DISTINCT b.id AS id FROM kotas b
     LEFT JOIN provinsi p ON p.id = b.provinsi_id
     WHERE (
       p.wilayah_id IN (${list})
       OR EXISTS (
         SELECT 1 FROM kabupaten k
         INNER JOIN provinsi p2 ON p2.id = k.provinsi_id
         WHERE p2.wilayah_id IN (${list})
           AND k.kode IS NOT NULL
           AND b.code IS NOT NULL
           AND trim(cast(k.kode AS text)) = trim(cast(b.code AS text))
       )
     )`,
    { type: QueryTypes.SELECT }
  );
  return (rows || []).map((r) => r.id).filter(Boolean);
}

/**
 * Semua UUID wilayah yang punya nama sama dengan wilayah referensi (master bisa punya duplikat baris).
 * Dipakai agar provinsi.wilayah_id (satu UUID) tetap cocok dengan users.wilayah_id (UUID lain, nama sama).
 */
async function resolveWilayahIdsSameName(wilayahId) {
  if (!wilayahId) return [];
  const wid = String(wilayahId).trim();
  const wilayahRow = await Wilayah.findByPk(wid, { attributes: ['id', 'name'] });
  if (wilayahRow && wilayahRow.name) {
    const allWilayah = await Wilayah.findAll({ attributes: ['id', 'name'], raw: true });
    const nameKey = (wilayahRow.name || '').trim().toLowerCase();
    const ids = (allWilayah || []).filter((w) => (w.name || '').trim().toLowerCase() === nameKey).map((w) => w.id);
    if (ids.length > 0) return ids;
  }
  return [wid];
}

/**
 * Semua UUID provinsi yang punya nama sama dengan provinsi referensi (master bisa punya duplikat baris).
 * Dipakai filter daftar/ekspor invoice agar cabang yang mereferensi UUID lain dengan nama sama tetap ikut.
 */
async function resolveProvinsiIdsSameName(provinsiId) {
  if (!provinsiId) return [];
  const pid = String(provinsiId).trim();
  const row = await Provinsi.findByPk(pid, { attributes: ['id', 'name'] });
  if (row && row.name) {
    const allProv = await Provinsi.findAll({ attributes: ['id', 'name'], raw: true });
    const nameKey = (row.name || '').trim().toLowerCase();
    const ids = (allProv || []).filter((p) => (p.name || '').trim().toLowerCase() === nameKey).map((p) => p.id);
    if (ids.length > 0) return ids;
  }
  return [pid];
}

/**
 * Resolve branch_id untuk filter wilayah (dinamis: nama wilayah + fallback via kabupaten/kota).
 * Dipakai agar filter Wilayah menampilkan data sesuai kota/provinsi yang ada di order.
 * - Resolve semua id wilayah dengan nama sama (duplikat nama).
 * - Cari cabang lewat Branch->Provinsi.wilayah_id.
 * - Fallback: cabang yang code-nya = kode kabupaten/kota di wilayah tersebut.
 */
async function getBranchIdsForWilayahDynamic(wilayahId) {
  if (!wilayahId) return [];
  const wilayahIds = await resolveWilayahIdsSameName(wilayahId);

  let branches = await Branch.findAll({
    attributes: ['id'],
    include: [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id: { [Op.in]: wilayahIds } } }]
  });
  let ids = branches.map((b) => b.id);
  if (ids.length === 0 && wilayahIds.length > 0) {
    const kabupatenInWilayah = await Kabupaten.findAll({
      attributes: ['kode'],
      include: [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id: { [Op.in]: wilayahIds } } }]
    });
    const kodes = (kabupatenInWilayah || []).map((k) => k.kode).filter(Boolean);
    if (kodes.length > 0) {
      const branchesByCode = await Branch.findAll({ where: { code: { [Op.in]: kodes } }, attributes: ['id'] });
      ids = branchesByCode.map((b) => b.id);
    }
  }
  if (ids.length === 0 && wilayahIds.length > 0) {
    ids = await getBranchIdsForWilayahSqlFallback(wilayahIds);
  }
  return ids;
}

/**
 * Mengembalikan array branch_id untuk scope wilayah (semua cabang di wilayah tersebut).
 * Menggunakan getBranchIdsForWilayahDynamic agar dinamis (nama + fallback kabupaten).
 */
async function getBranchIdsForWilayah(wilayahId) {
  return getBranchIdsForWilayahDynamic(wilayahId);
}

/**
 * Cek apakah branch_id termasuk dalam wilayah user (untuk koordinator).
 */
async function branchBelongsToWilayah(branchId, wilayahId) {
  if (!wilayahId || !branchId) return false;
  const ids = await getBranchIdsForWilayah(wilayahId);
  return ids.includes(branchId);
}

/**
 * Cek apakah invoice boleh diakses koordinator (branch invoice ada di wilayah koordinator).
 * - Jika wilayah belum punya cabang ter-link (branchIds kosong): izinkan (konsisten dengan list).
 * - Jika branch invoice ada di daftar cabang wilayah: izinkan.
 * - Fallback: cek langsung Branch -> Provinsi.wilayah_id (untuk cabang kabupaten/kota yang memang di wilayah tapi belum masuk daftar).
 */
async function invoiceInKoordinatorWilayah(invoice, wilayahId) {
  if (!wilayahId || !invoice || !invoice.branch_id) return true;
  const branchIds = await getBranchIdsForWilayah(wilayahId);
  if (branchIds.length === 0) return true;
  if (branchIds.includes(invoice.branch_id)) return true;
  const branch = await Branch.findByPk(invoice.branch_id, {
    attributes: ['id'],
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }],
    raw: false
  });
  if (branch && branch.Provinsi && branch.Provinsi.wilayah_id === wilayahId) return true;
  return false;
}

module.exports = {
  getBranchIdsForWilayah,
  getBranchIdsForWilayahDynamic,
  branchBelongsToWilayah,
  invoiceInKoordinatorWilayah,
  resolveWilayahIdsSameName,
  resolveProvinsiIdsSameName
};
