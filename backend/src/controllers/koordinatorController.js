const asyncHandler = require('express-async-handler');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const { getDashboardData } = require('../services/dashboardScopeService');

/**
 * GET /api/v1/koordinator/dashboard
 * Rekapitulasi wilayah: order, owner, invoice, hotel, visa, ticket, bus (semua cabang di wilayah).
 */
const getDashboard = asyncHandler(async (req, res) => {
  const wilayahId = req.user.wilayah_id;
  if (!wilayahId) return res.status(403).json({ success: false, message: 'Koordinator harus terikat wilayah' });

  const branchIds = await getBranchIdsForWilayah(wilayahId);
  const data = await getDashboardData(branchIds);
  res.json({ success: true, data });
});

module.exports = {
  getDashboard,
  getBranchIdsForWilayah
};
