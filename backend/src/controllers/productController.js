const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Product, ProductPrice, ProductAvailability, Branch, User, BusinessRuleConfig } = require('../models');
const { getAvailabilityByDateRange } = require('../services/hotelAvailabilityService');
const { ROLES } = require('../constants');
const { BUSINESS_RULE_KEYS } = require('../constants');

/** Ambil kurs dari business rules (global) */
async function getCurrencyRates() {
  const row = await BusinessRuleConfig.findOne({ where: { key: BUSINESS_RULE_KEYS.CURRENCY_RATES, branch_id: null }, raw: true });
  let cr = row?.value;
  if (typeof cr === 'string') {
    try { cr = JSON.parse(cr); } catch (e) { cr = null; }
  }
  const SAR_TO_IDR = (cr && typeof cr.SAR_TO_IDR === 'number') ? cr.SAR_TO_IDR : 4200;
  const USD_TO_IDR = (cr && typeof cr.USD_TO_IDR === 'number') ? cr.USD_TO_IDR : 15500;
  return { SAR_TO_IDR, USD_TO_IDR };
}

/** Dari satu nilai dan mata uang, isi idr, sar, usd */
function fillTriple(sourceCurrency, value, rates) {
  const { SAR_TO_IDR, USD_TO_IDR } = rates;
  const v = parseFloat(value) || 0;
  if (sourceCurrency === 'IDR') return { idr: v, sar: v / SAR_TO_IDR, usd: v / USD_TO_IDR };
  if (sourceCurrency === 'SAR') return { idr: v * SAR_TO_IDR, sar: v, usd: (v * SAR_TO_IDR) / USD_TO_IDR };
  return { idr: v * USD_TO_IDR, sar: (v * USD_TO_IDR) / SAR_TO_IDR, usd: v };
}

/**
 * Resolve effective price: special owner > branch > general (pusat).
 */
async function getEffectivePrice(productId, branchId, ownerId, meta = {}, currency = 'IDR') {
  const today = new Date().toISOString().slice(0, 10);
  const where = { product_id: productId, currency };
  const effectiveWhere = {
    [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: today } }],
    [Op.or]: [{ effective_until: null }, { effective_until: { [Op.gte]: today } }]
  };

  let special = null;
  let branch = null;
  let general = null;

  if (ownerId) {
    special = await ProductPrice.findOne({
      where: { ...where, owner_id: ownerId, branch_id: branchId, ...effectiveWhere },
      order: [['created_at', 'DESC']]
    });
  }
  if (branchId) {
    branch = await ProductPrice.findOne({
      where: { ...where, branch_id: branchId, owner_id: null, ...effectiveWhere },
      order: [['created_at', 'DESC']]
    });
  }
  general = await ProductPrice.findOne({
    where: { ...where, branch_id: null, owner_id: null, ...effectiveWhere },
    order: [['created_at', 'DESC']]
  });

  const price = special || branch || general;
  return price ? parseFloat(price.amount) : null;
}

const PRODUCT_ALLOWED_SORT = ['code', 'name', 'type', 'is_active', 'created_at'];

/**
 * GET /api/v1/products
 * List products (with optional prices for branch/owner). For invoice: show general + branch prices.
 */
const list = asyncHandler(async (req, res) => {
  const { type, branch_id, owner_id, with_prices, is_package, include_inactive, limit = 25, page = 1, sort_by, sort_order } = req.query;
  const where = {};
  if (include_inactive !== 'true' && include_inactive !== '1') where.is_active = true;
  if (type) where.type = type;
  if (is_package === 'true' || is_package === '1') where.is_package = true;

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = PRODUCT_ALLOWED_SORT.includes(sort_by) ? sort_by : 'code';
  const sortDir = (sort_order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const includeList = with_prices === 'true'
    ? [
        { model: ProductPrice, as: 'ProductPrices', required: false },
        ...(type === 'hotel' ? [{ model: ProductAvailability, as: 'ProductAvailability', required: false }] : [])
      ]
    : [];
  const { count, rows: products } = await Product.findAndCountAll({
    where,
    order: [[sortCol, sortDir]],
    include: includeList,
    limit: lim,
    offset,
    distinct: true
  });

  if (with_prices === 'true') {
    // Role hotel di menu Products: tampilkan harga umum (pusat) saja, sama seperti admin pusat
    const viewAsPusat = req.query.view_as_pusat === 'true' && req.user?.role === 'role_hotel';
    const bid = viewAsPusat ? null : (branch_id || req.user?.branch_id || null);
    const oid = owner_id || null;
    const result = (products || []).map(p => {
      const prices = p.ProductPrices || [];
      const generalPrices = prices.filter(pr => !pr.branch_id && !pr.owner_id);
      const general = generalPrices[0] || null;
      const branch = bid ? prices.find(pr => pr.branch_id === bid && !pr.owner_id) : null;
      const special = oid ? prices.find(pr => pr.owner_id === oid) : null;
      const emptyMeta = (pr) => !pr.meta || (typeof pr.meta === 'object' && Object.keys(pr.meta).length === 0);
      const simpleGeneral = generalPrices.filter(emptyMeta);
      const byCur = (c) => simpleGeneral.find(pr => pr.currency === c);
      const price_general_idr = byCur('IDR') ? parseFloat(byCur('IDR').amount) : null;
      const price_general_sar = byCur('SAR') ? parseFloat(byCur('SAR').amount) : null;
      const price_general_usd = byCur('USD') ? parseFloat(byCur('USD').amount) : null;
      const base = {
        ...p.toJSON(),
        price_general: general ? parseFloat(general.amount) : null,
        price_branch: branch ? parseFloat(branch.amount) : null,
        price_special: special ? parseFloat(special.amount) : null,
        currency: general?.currency || branch?.currency || 'IDR',
        price_general_idr: price_general_idr ?? null,
        price_general_sar: price_general_sar ?? null,
        price_general_usd: price_general_usd ?? null
      };
      if (type === 'hotel') {
        const av = p.ProductAvailability;
        const avMeta = (av?.meta || {}) || {};
        const roomTypesMeta = avMeta.room_types || {};
        const generalPrices = prices.filter(pr => !pr.branch_id && !pr.owner_id);
        const rooms = {};
        ['single', 'double', 'triple', 'quad', 'quint'].forEach(rt => {
          const qty = Number(roomTypesMeta[rt]) || 0;
          const priceRow = generalPrices.find(pr => pr.meta?.room_type === rt && !pr.meta?.with_meal);
          const priceWithMeal = generalPrices.find(pr => pr.meta?.room_type === rt && pr.meta?.with_meal);
          const basePrice = priceRow ? parseFloat(priceRow.amount) : (priceWithMeal ? parseFloat(priceWithMeal.amount) - (base.meta?.meal_price || 0) : 0);
          rooms[rt] = { quantity: qty, price: basePrice };
        });
        base.room_breakdown = rooms;
        base.prices_by_room = rooms;
      }
      return base;
    });
    const totalPages = Math.ceil(count / lim) || 1;
    return res.json({
      success: true,
      data: result,
      pagination: { total: count, page: pg, limit: lim, totalPages }
    });
  }

  const totalPages = Math.ceil(count / lim) || 1;
  res.json({
    success: true,
    data: products,
    pagination: { total: count, page: pg, limit: lim, totalPages }
  });
});

/**
 * GET /api/v1/products/:id
 */
const getById = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, {
    include: [
      { model: ProductPrice, as: 'ProductPrices' },
      { model: ProductAvailability, as: 'ProductAvailability', required: false }
    ]
  });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  res.json({ success: true, data: product });
});

/**
 * GET /api/v1/products/:id/price
 * Effective price for branch + owner (for order form).
 */
const getPrice = asyncHandler(async (req, res) => {
  const { branch_id, owner_id, currency } = req.query;
  const branchId = branch_id || req.user?.branch_id;
  const ownerId = owner_id || null;
  const amount = await getEffectivePrice(req.params.id, branchId, ownerId, {}, currency || 'IDR');
  if (amount == null) return res.status(404).json({ success: false, message: 'Harga tidak ditemukan' });
  res.json({ success: true, data: { amount, currency: currency || 'IDR' } });
});

/**
 * Generate kode hotel: HTL-{abbrev}-{loc}-{seq}. Contoh: Royal Andalus Makkah → HTL-RA-M-001
 */
async function generateHotelCode(name, location) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const abbrev = words.length === 0 ? 'XX' : words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const loc = (location === 'madinah') ? 'D' : 'M';
  const prefix = `HTL-${abbrev}-${loc}-`;
  const existing = await Product.findAll({
    where: { type: 'hotel', code: { [Op.like]: `${prefix}%` } },
    attributes: ['code']
  });
  const nums = existing
    .map(p => parseInt(String(p.code || '').replace(prefix, '') || '0', 10))
    .filter(n => !Number.isNaN(n));
  const nextSeq = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * POST /api/v1/products/hotels - buat hotel, type & code otomatis dari system
 */
const createHotel = asyncHandler(async (req, res) => {
  const { name, description, meta } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'name wajib' });
  const location = meta?.location || 'makkah';
  const code = await generateHotelCode(name, location);
  const product = await Product.create({
    type: 'hotel',
    code,
    name: name.trim(),
    description: description || null,
    is_package: false,
    meta: meta || {},
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: product });
});

/**
 * POST /api/v1/products - admin pusat only
 */
const create = asyncHandler(async (req, res) => {
  const { type, code, name, description, is_package, meta } = req.body;
  if (!type || !name) return res.status(400).json({ success: false, message: 'type dan name wajib' });
  let finalCode = code;
  if (type === 'hotel' && (!finalCode || finalCode.trim() === '')) {
    const location = meta?.location || 'makkah';
    finalCode = await generateHotelCode(name, location);
  }
  if (!finalCode || finalCode.trim() === '') return res.status(400).json({ success: false, message: 'code wajib' });
  const product = await Product.create({
    type, code: finalCode, name,
    description: description || null,
    is_package: !!is_package,
    meta: meta || {},
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: product });
});

/**
 * PATCH /api/v1/products/:id - admin pusat / admin cabang
 */
const update = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  const { code, name, description, is_package, meta, is_active } = req.body;
  if (code !== undefined) product.code = code;
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (is_package !== undefined) product.is_package = is_package;
  if (meta !== undefined) product.meta = meta;
  if (is_active !== undefined) product.is_active = is_active;
  await product.save();
  res.json({ success: true, data: product });
});

/**
 * DELETE /api/v1/products/:id - hard delete (hapus permanen dari database). Super Admin / Admin Pusat only.
 * ProductPrice dan ProductAvailability akan terhapus otomatis (CASCADE).
 */
const remove = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  await product.destroy();
  res.json({ success: true, message: 'Product berhasil dihapus' });
});

/**
 * GET /api/v1/products/prices
 * List prices (general + branch for current user branch, or all for pusat).
 */
const listPrices = asyncHandler(async (req, res) => {
  const { product_id, branch_id, owner_id } = req.query;
  const where = {};
  if (product_id) where.product_id = product_id;
  const branchId = branch_id || (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN_PUSAT ? req.user.branch_id : null);
  if (branchId) where[Op.or] = [{ branch_id: branchId }, { branch_id: null }];
  else where.branch_id = null;

  const prices = await ProductPrice.findAll({
    where,
    include: [
      { model: Product, attributes: ['id', 'code', 'name', 'type'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: User, as: 'Owner', attributes: ['id', 'name', 'email'], foreignKey: 'owner_id' }
    ],
    order: [['product_id', 'ASC'], ['branch_id', 'ASC'], ['owner_id', 'ASC']]
  });
  res.json({ success: true, data: prices });
});

/**
 * POST /api/v1/products/prices
 * Create price: general (pusat), branch, or special owner.
 * Bisa satu mata uang (currency + amount) atau tiga mata uang (amount_idr, amount_sar, amount_usd).
 * Jika amount_idr/sar/usd dipakai: kurs dari business rules, isi yang kosong, simpan 3 baris (IDR, SAR, USD).
 */
const createPrice = asyncHandler(async (req, res) => {
  const { product_id, branch_id, owner_id, currency, amount, amount_idr, amount_sar, amount_usd, meta, effective_from, effective_until } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id wajib' });

  const canSetBranch = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT].includes(req.user.role);
  const canSetOwner = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI].includes(req.user.role);

  let finalBranchId = branch_id || null;
  let finalOwnerId = owner_id || null;

  if (finalBranchId && !canSetBranch) finalBranchId = null;
  if (finalOwnerId && !canSetOwner) finalOwnerId = null;
  if ((req.user.role === ROLES.INVOICE_KOORDINATOR || req.user.role === ROLES.ROLE_INVOICE_SAUDI) && finalBranchId !== req.user.branch_id) finalBranchId = req.user.branch_id;

  const metaObj = meta && typeof meta === 'object' ? meta : {};
  const hasMulti = amount_idr != null || amount_sar != null || amount_usd != null;
  const hasSimple = currency != null && amount != null;
  const isEmptyMeta = !metaObj || Object.keys(metaObj).length === 0;

  if (hasMulti && isEmptyMeta) {
    const rates = await getCurrencyRates();
    let idr = amount_idr != null ? parseFloat(amount_idr) : null;
    let sar = amount_sar != null ? parseFloat(amount_sar) : null;
    let usd = amount_usd != null ? parseFloat(amount_usd) : null;
    if (idr != null && !Number.isNaN(idr)) {
      sar = sar ?? idr / rates.SAR_TO_IDR;
      usd = usd ?? idr / rates.USD_TO_IDR;
    } else if (sar != null && !Number.isNaN(sar)) {
      idr = idr ?? sar * rates.SAR_TO_IDR;
      usd = usd ?? idr / rates.USD_TO_IDR;
    } else if (usd != null && !Number.isNaN(usd)) {
      idr = idr ?? usd * rates.USD_TO_IDR;
      sar = sar ?? idr / rates.SAR_TO_IDR;
    }
    if (idr == null || Number.isNaN(idr)) return res.status(400).json({ success: false, message: 'Berikan minimal satu: amount_idr, amount_sar, atau amount_usd' });

    const existing = await ProductPrice.findAll({
      where: { product_id, branch_id: finalBranchId, owner_id: finalOwnerId }
    });
    const withEmptyMeta = existing.filter(pr => !pr.meta || Object.keys(pr.meta || {}).length === 0);
    for (const pr of withEmptyMeta) await pr.destroy();

    for (const { cur, amt } of [
      { cur: 'IDR', amt: idr },
      { cur: 'SAR', amt: sar },
      { cur: 'USD', amt: usd }
    ]) {
      await ProductPrice.create({
        product_id,
        branch_id: finalBranchId,
        owner_id: finalOwnerId,
        currency: cur,
        amount: amt,
        meta: {},
        effective_from: effective_from || null,
        effective_until: effective_until || null,
        created_by: req.user.id
      });
    }
    const created = await ProductPrice.findAll({
      where: { product_id, branch_id: finalBranchId, owner_id: finalOwnerId, currency: ['IDR', 'SAR', 'USD'] },
      include: [{ model: Product, attributes: ['id', 'code', 'name'] }]
    });
    return res.status(201).json({ success: true, data: created, message: 'Harga IDR, SAR, USD tersimpan' });
  }

  if (!hasSimple) return res.status(400).json({ success: false, message: 'Berikan currency + amount, atau amount_idr/amount_sar/amount_usd (dengan meta kosong)' });

  const price = await ProductPrice.create({
    product_id,
    branch_id: finalBranchId,
    owner_id: finalOwnerId,
    currency: currency || 'IDR',
    amount,
    meta: metaObj,
    effective_from: effective_from || null,
    effective_until: effective_until || null,
    created_by: req.user.id
  });
  const full = await ProductPrice.findByPk(price.id, { include: [{ model: Product, attributes: ['id', 'code', 'name'] }] });
  res.status(201).json({ success: true, data: full });
});

/**
 * PATCH /api/v1/products/prices/:id
 */
const updatePrice = asyncHandler(async (req, res) => {
  const price = await ProductPrice.findByPk(req.params.id);
  if (!price) return res.status(404).json({ success: false, message: 'Price tidak ditemukan' });
  const { amount, currency, effective_from, effective_until } = req.body;
  if (amount !== undefined) price.amount = amount;
  if (currency !== undefined) price.currency = currency;
  if (effective_from !== undefined) price.effective_from = effective_from;
  if (effective_until !== undefined) price.effective_until = effective_until;
  await price.save();
  res.json({ success: true, data: price });
});

/**
 * DELETE /api/v1/products/prices/:id
 */
const deletePrice = asyncHandler(async (req, res) => {
  const price = await ProductPrice.findByPk(req.params.id);
  if (!price) return res.status(404).json({ success: false, message: 'Price tidak ditemukan' });
  await price.destroy();
  res.json({ success: true, message: 'Price berhasil dihapus' });
});

/**
 * GET /api/v1/products/:id/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Availability realtime per tanggal (hotel): per room_type total, booked, available. Hanya product type hotel.
 */
const getAvailability = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const data = await getAvailabilityByDateRange(product.id, from, to);
  res.json({ success: true, data });
});

module.exports = {
  list,
  getById,
  getPrice,
  getAvailability,
  create,
  createHotel,
  update,
  remove,
  listPrices,
  createPrice,
  updatePrice,
  deletePrice,
  getEffectivePrice
};
