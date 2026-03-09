const { Op } = require('sequelize');
const { Branch, Provinsi, Wilayah, Kabupaten } = require('../models');

/**
 * Resolve branch_id untuk filter wilayah (dinamis: nama wilayah + fallback via kabupaten/kota).
 * Dipakai agar filter Wilayah menampilkan data sesuai kota/provinsi yang ada di order.
 * - Resolve semua id wilayah dengan nama sama (duplikat nama).
 * - Cari cabang lewat Branch->Provinsi.wilayah_id.
 * - Fallback: cabang yang code-nya = kode kabupaten/kota di wilayah tersebut.
 */
async function getBranchIdsForWilayahDynamic(wilayahId) {
  if (!wilayahId) return [];
  const wid = String(wilayahId).trim();
  const wilayahRow = await Wilayah.findByPk(wid, { attributes: ['id', 'name'] });
  const wilayahIds = [];
  if (wilayahRow && wilayahRow.name) {
    const allWilayah = await Wilayah.findAll({ attributes: ['id', 'name'], raw: true });
    const nameKey = (wilayahRow.name || '').trim().toLowerCase();
    wilayahIds.push(...(allWilayah || []).filter((w) => (w.name || '').trim().toLowerCase() === nameKey).map((w) => w.id));
  }
  if (wilayahIds.length === 0) wilayahIds.push(wid);

  let branches = await Branch.findAll({
    where: { is_active: true },
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
      const branchesByCode = await Branch.findAll({ where: { code: { [Op.in]: kodes }, is_active: true }, attributes: ['id'] });
      ids = branchesByCode.map((b) => b.id);
    }
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

module.exports = { getBranchIdsForWilayah, getBranchIdsForWilayahDynamic, branchBelongsToWilayah, invoiceInKoordinatorWilayah };
