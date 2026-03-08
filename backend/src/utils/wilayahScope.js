const { Branch, Provinsi } = require('../models');

/**
 * Mengembalikan array branch_id untuk scope wilayah (semua cabang di wilayah tersebut).
 * Jika wilayahId null, return [].
 */
async function getBranchIdsForWilayah(wilayahId) {
  if (!wilayahId) return [];
  const branches = await Branch.findAll({
    attributes: ['id'],
    include: [{ model: Provinsi, as: 'Provinsi', where: { wilayah_id: wilayahId }, required: true }],
    raw: false
  });
  return branches.map(b => b.id);
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

module.exports = { getBranchIdsForWilayah, branchBelongsToWilayah, invoiceInKoordinatorWilayah };
