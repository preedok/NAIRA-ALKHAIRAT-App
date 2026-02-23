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

module.exports = { getBranchIdsForWilayah, branchBelongsToWilayah };
