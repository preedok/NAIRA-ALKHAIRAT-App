const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const {
  AccurateQuotation,
  AccuratePurchaseOrder,
  AccurateWarehouse,
  AccurateFixedAsset,
  AccurateDepreciationSchedule,
  Branch,
  User,
  ChartOfAccount,
  AccountingPeriod
} = require('../models');

/**
 * GET /api/v1/accounting/accurate/dashboard
 * Summary untuk halaman Accurate Online (counts per modul).
 */
const getDashboard = asyncHandler(async (req, res) => {
  const [quotationsCount, purchaseOrdersCount, warehousesCount, fixedAssetsCount] = await Promise.all([
    AccurateQuotation.count(),
    AccuratePurchaseOrder.count(),
    AccurateWarehouse.count(),
    AccurateFixedAsset.count()
  ]);

  res.json({
    success: true,
    data: {
      penjualan: { quotations: quotationsCount },
      pembelian: { purchase_orders: purchaseOrdersCount },
      persediaan: { warehouses: warehousesCount },
      aset_tetap: { fixed_assets: fixedAssetsCount }
    }
  });
});

/**
 * GET /api/v1/accounting/accurate/quotations
 */
const listQuotations = asyncHandler(async (req, res) => {
  const list = await AccurateQuotation.findAll({
    order: [['quotation_date', 'DESC'], ['created_at', 'DESC']],
    limit: 100,
    include: [{ model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false }]
  });
  res.json({ success: true, data: list });
});

/**
 * GET /api/v1/accounting/accurate/purchase-orders
 */
const listPurchaseOrders = asyncHandler(async (req, res) => {
  const list = await AccuratePurchaseOrder.findAll({
    order: [['order_date', 'DESC'], ['created_at', 'DESC']],
    limit: 100,
    include: [{ model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false }]
  });
  res.json({ success: true, data: list });
});

/**
 * GET /api/v1/accounting/accurate/warehouses
 */
const listWarehouses = asyncHandler(async (req, res) => {
  const list = await AccurateWarehouse.findAll({
    where: req.query.active !== 'false' ? { is_active: true } : undefined,
    order: [['code', 'ASC']],
    include: [{ model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false }]
  });
  res.json({ success: true, data: list });
});

/**
 * POST /api/v1/accounting/accurate/warehouses
 */
const createWarehouse = asyncHandler(async (req, res) => {
  const { code, name, branch_id } = req.body || {};
  if (!code || !name) return res.status(400).json({ success: false, message: 'code dan name wajib' });
  const w = await AccurateWarehouse.create({
    code: String(code).trim(),
    name: String(name).trim(),
    branch_id: branch_id || null,
    is_active: true
  });
  res.status(201).json({ success: true, data: w });
});

/**
 * GET /api/v1/accounting/accurate/fixed-assets
 */
const listFixedAssets = asyncHandler(async (req, res) => {
  const list = await AccurateFixedAsset.findAll({
    order: [['asset_code', 'ASC']],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: AccurateDepreciationSchedule, as: 'DepreciationSchedules', required: false, limit: 12, order: [['period_label', 'DESC']] }
    ]
  });
  res.json({ success: true, data: list });
});

/**
 * POST /api/v1/accounting/accurate/fixed-assets
 */
const createFixedAsset = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const {
    asset_code,
    asset_name,
    category,
    purchase_date,
    acquisition_cost,
    residual_value,
    useful_life_years,
    depreciation_method,
    asset_account_id,
    accumulated_depreciation_account_id,
    expense_account_id,
    branch_id
  } = body;
  if (!asset_code || !asset_name) return res.status(400).json({ success: false, message: 'asset_code dan asset_name wajib' });
  const cost = parseFloat(acquisition_cost) || 0;
  const residual = parseFloat(residual_value) || 0;
  const years = Math.max(1, parseInt(useful_life_years, 10) || 1);
  const asset = await AccurateFixedAsset.create({
    asset_code: String(asset_code).trim(),
    asset_name: String(asset_name).trim(),
    category: category || null,
    purchase_date: purchase_date || null,
    acquisition_cost: cost,
    residual_value: residual,
    useful_life_years: years,
    depreciation_method: depreciation_method || 'straight_line',
    asset_account_id: asset_account_id || null,
    accumulated_depreciation_account_id: accumulated_depreciation_account_id || null,
    expense_account_id: expense_account_id || null,
    branch_id: branch_id || null,
    status: 'active'
  });
  res.status(201).json({ success: true, data: asset });
});

/**
 * PATCH /api/v1/accounting/accurate/fixed-assets/:id
 */
const updateFixedAsset = asyncHandler(async (req, res) => {
  const asset = await AccurateFixedAsset.findByPk(req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
  const allowed = ['asset_name', 'category', 'purchase_date', 'acquisition_cost', 'residual_value', 'useful_life_years', 'depreciation_method', 'asset_account_id', 'accumulated_depreciation_account_id', 'expense_account_id', 'branch_id', 'status'];
  const updates = {};
  allowed.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });
  await asset.update(updates);
  res.json({ success: true, data: asset });
});

/**
 * POST /api/v1/accounting/accurate/fixed-assets/:id/calculate-depreciation
 * Generate jadwal penyusutan (update BE) dan return schedule untuk FE.
 */
const calculateDepreciation = asyncHandler(async (req, res) => {
  const asset = await AccurateFixedAsset.findByPk(req.params.id, {
    include: [{ model: AccurateDepreciationSchedule, as: 'DepreciationSchedules' }]
  });
  if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
  const cost = parseFloat(asset.acquisition_cost) || 0;
  const residual = parseFloat(asset.residual_value) || 0;
  const years = Math.max(1, parseInt(asset.useful_life_years, 10) || 1);
  const depreciable = cost - residual;
  if (depreciable <= 0) return res.json({ success: true, data: { schedule: [], message: 'Tidak ada nilai yang disusutkan' } });

  const method = asset.depreciation_method || 'straight_line';
  const monthsTotal = years * 12;
  let annualAmount = 0;
  if (method === 'straight_line') annualAmount = depreciable / years;

  const startYear = asset.purchase_date ? new Date(asset.purchase_date).getFullYear() : new Date().getFullYear();
  const startMonth = asset.purchase_date ? new Date(asset.purchase_date).getMonth() + 1 : 1;

  await AccurateDepreciationSchedule.destroy({ where: { fixed_asset_id: asset.id } });

  const schedule = [];
  let accumulated = 0;
  for (let i = 0; i < years; i++) {
    const periodLabel = `${startYear + i}-${String(startMonth).padStart(2, '0')}`;
    const amount = i === 0 && startMonth > 1 ? (annualAmount * (12 - startMonth + 1)) / 12 : annualAmount;
    accumulated += amount;
    const row = await AccurateDepreciationSchedule.create({
      fixed_asset_id: asset.id,
      period_label: `${startYear + i}`,
      depreciation_amount: Math.round(amount * 100) / 100,
      accumulated_depreciation: Math.round(accumulated * 100) / 100
    });
    schedule.push(row.get ? row.get({ plain: true }) : row);
  }

  res.json({ success: true, data: { schedule, message: 'Jadwal penyusutan telah dihitung' } });
});

/**
 * GET /api/v1/accounting/accurate/fixed-assets/:id/depreciation
 */
const getDepreciationSchedule = asyncHandler(async (req, res) => {
  const list = await AccurateDepreciationSchedule.findAll({
    where: { fixed_asset_id: req.params.id },
    order: [['period_label', 'ASC']]
  });
  res.json({ success: true, data: list });
});

module.exports = {
  getDashboard,
  listQuotations,
  listPurchaseOrders,
  listWarehouses,
  createWarehouse,
  listFixedAssets,
  createFixedAsset,
  updateFixedAsset,
  calculateDepreciation,
  getDepreciationSchedule
};
