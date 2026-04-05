const { Branch } = require('../models');
const { ROLES } = require('../constants');
const { getBranchIdsForWilayah } = require('./wilayahScope');

const KOORDINATOR_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];

/**
 * Scope cabang untuk role hotel (sama logika dengan hotelController.getHotelBranchIds).
 */
async function getHotelBranchIds(user) {
  if (user.role === ROLES.SUPER_ADMIN) {
    const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
    return branches.map((b) => b.id);
  }
  if (KOORDINATOR_ROLES.includes(user.role) && user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  if (user.branch_id) return [user.branch_id];
  if (user.wilayah_id) {
    const ids = await getBranchIdsForWilayah(user.wilayah_id);
    if (ids.length > 0) return ids;
  }
  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id'], raw: true });
  return branches.map((b) => b.id);
}

module.exports = { getHotelBranchIds };
