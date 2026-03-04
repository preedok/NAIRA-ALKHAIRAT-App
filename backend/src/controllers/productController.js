const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const { Product, ProductPrice, ProductAvailability, Branch, User, BusinessRuleConfig } = require('../models');
const { getAvailabilityByDateRange, getHotelCalendar } = require('../services/hotelAvailabilityService');
const { getVisaCalendar } = require('../services/visaAvailabilityService');
const { getTicketCalendar } = require('../services/ticketAvailabilityService');
const { getBusCalendar } = require('../services/busAvailabilityService');
const { ROLES, VISA_KIND, BANDARA_TIKET, BANDARA_TIKET_CODES, TICKET_PERIOD_TYPES, TICKET_TRIP_TYPES, BUS_ROUTE_TYPES, BUS_TRIP_TYPES } = require('../constants');
const { BUSINESS_RULE_KEYS } = require('../constants');
const sequelize = require('../config/sequelize');

const VISA_KIND_VALUES = Object.values(VISA_KIND);

/** Senin dari minggu yang berisi dateStr (YYYY-MM-DD). Return YYYY-MM-DD. */
function getWeekStart(dateStr) {
  const d = new Date(String(dateStr).slice(0, 10));
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

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
 * Untuk produk tiket: jika meta.bandara diisi, cari harga general dengan meta.bandara yang sama.
 */
async function getEffectivePrice(productId, branchId, ownerId, meta = {}, currency = 'IDR') {
  const maybeBus = meta.trip_type != null || meta.travel_date != null || meta.route_type != null || meta.bus_type != null;
  if (maybeBus) {
    const product = await Product.findByPk(productId, { attributes: ['id', 'type', 'meta'] });
    if (product && product.type === 'bus' && product.meta && product.meta.route_prices_by_trip) {
      const tripType = (meta.trip_type && BUS_TRIP_TYPES.includes(meta.trip_type)) ? meta.trip_type : 'round_trip';
      const price = product.meta.route_prices_by_trip[tripType];
      if (typeof price === 'number' && price >= 0) return price;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const effectiveWhere = {
    [Op.and]: [
      { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: today } }] },
      { [Op.or]: [{ effective_until: null }, { effective_until: { [Op.gte]: today } }] }
    ]
  };

  const bandara = meta && meta.bandara && BANDARA_TIKET_CODES.includes(meta.bandara) ? meta.bandara : null;
  if (bandara) {
    const av = await ProductAvailability.findOne({ where: { product_id: productId } });
    const schedules = (av?.meta && av.meta.bandara_schedules && av.meta.bandara_schedules[bandara]) ? av.meta.bandara_schedules[bandara] : null;
    if (schedules) {
      let slot = null;
      const dateStr = meta.date ? String(meta.date).slice(0, 10) : null;
      if (dateStr && schedules.day && schedules.day[dateStr]) slot = schedules.day[dateStr];
      if (!slot && dateStr && schedules.week) {
        const weekKey = getWeekStart(dateStr);
        if (weekKey && schedules.week[weekKey]) slot = schedules.week[weekKey];
      }
      if (!slot && dateStr && schedules.month) {
        const monthKey = dateStr.slice(0, 7);
        if (schedules.month[monthKey]) slot = schedules.month[monthKey];
      }
      if (!slot && schedules.default) slot = schedules.default;
      if (slot && slot.price_idr != null) return parseFloat(slot.price_idr);
    }
    const price = await ProductPrice.findOne({
      where: {
        product_id: productId,
        branch_id: null,
        owner_id: null,
        currency,
        ...effectiveWhere,
        [Op.and]: [sequelize.where(sequelize.literal("meta->>'bandara'"), Op.eq, bandara)]
      },
      order: [['created_at', 'DESC']]
    });
    return price ? parseFloat(price.amount) : null;
  }

  const where = { product_id: productId, currency, ...effectiveWhere };
  let special = null;
  let branch = null;
  let general = null;

  if (ownerId) {
    special = await ProductPrice.findOne({
      where: { ...where, owner_id: ownerId, branch_id: branchId },
      order: [['created_at', 'DESC']]
    });
  }
  if (branchId) {
    branch = await ProductPrice.findOne({
      where: { ...where, branch_id: branchId, owner_id: null },
      order: [['created_at', 'DESC']]
    });
  }
  general = await ProductPrice.findOne({
    where: { ...where, branch_id: null, owner_id: null },
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
  const { type, branch_id, owner_id, with_prices, is_package, include_inactive, limit = 25, page = 1, sort_by, sort_order, name } = req.query;
  const where = {};
  if (include_inactive !== 'true' && include_inactive !== '1') where.is_active = true;
  if (type) where.type = type;
  if (is_package === 'true' || is_package === '1') where.is_package = true;
  if (name != null && String(name).trim() !== '') {
    const term = String(name).trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    where.name = { [Op.iLike]: `%${term}%` };
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = PRODUCT_ALLOWED_SORT.includes(sort_by) ? sort_by : 'code';
  const sortDir = (sort_order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const includeList = with_prices === 'true'
    ? [
        { model: ProductPrice, as: 'ProductPrices', required: false },
        { model: ProductAvailability, as: 'ProductAvailability', required: false }
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
      const onlyRefCurrencyMeta = (pr) => pr.meta && typeof pr.meta === 'object' && Object.keys(pr.meta).length === 1 && (pr.meta.reference_currency === 'IDR' || pr.meta.reference_currency === 'SAR' || pr.meta.reference_currency === 'USD');
      const simpleGeneral = generalPrices.filter(pr => emptyMeta(pr) || onlyRefCurrencyMeta(pr));
      const byCur = (c) => simpleGeneral.find(pr => pr.currency === c);
      const price_general_idr = byCur('IDR') ? parseFloat(byCur('IDR').amount) : null;
      const price_general_sar = byCur('SAR') ? parseFloat(byCur('SAR').amount) : null;
      const price_general_usd = byCur('USD') ? parseFloat(byCur('USD').amount) : null;
      let refCurrencyFromPrice = (byCur('IDR')?.meta?.reference_currency || byCur('SAR')?.meta?.reference_currency || byCur('USD')?.meta?.reference_currency) || null;
      if (!refCurrencyFromPrice && generalPrices.length > 0) {
        const withRef = generalPrices.find(pr => pr.meta && (pr.meta.reference_currency === 'IDR' || pr.meta.reference_currency === 'SAR' || pr.meta.reference_currency === 'USD'));
        if (withRef) refCurrencyFromPrice = withRef.meta.reference_currency;
      }
      const refCur = refCurrencyFromPrice || (p.meta && typeof p.meta === 'object' && p.meta.currency) || general?.currency || 'IDR';
      const generalInRefCur = generalPrices.find(pr => pr.currency === refCur) || general;
      const base = {
        ...p.toJSON(),
        price_general: generalInRefCur ? parseFloat(generalInRefCur.amount) : (general ? parseFloat(general.amount) : null),
        price_branch: branch ? parseFloat(branch.amount) : null,
        price_special: special ? parseFloat(special.amount) : null,
        currency: (p.meta && typeof p.meta === 'object' && p.meta.currency) ? p.meta.currency : (refCurrencyFromPrice || general?.currency || branch?.currency || 'IDR'),
        price_general_idr: price_general_idr ?? null,
        price_general_sar: price_general_sar ?? null,
        price_general_usd: price_general_usd ?? null
      };
      const productType = p.type || (p.toJSON && p.toJSON().type);
      if (productType === 'hotel') {
        const av = p.ProductAvailability;
        const avMeta = (av?.meta || {}) || {};
        const roomTypesMeta = avMeta.room_types || {};
        const generalPricesHotel = prices.filter(pr => !pr.branch_id && !pr.owner_id);
        const rooms = {};
        const byRoomRefCur = (rt, withMeal) => generalPricesHotel.find(pr => pr.meta?.room_type === rt && (!!pr.meta?.with_meal) === withMeal && pr.currency === refCur);
        let mealPriceInRef = base.meta && typeof base.meta.meal_price === 'number' ? base.meta.meal_price : null;
        ['single', 'double', 'triple', 'quad', 'quint'].forEach(rt => {
          const priceRow = byRoomRefCur(rt, false);
          const priceWithMeal = byRoomRefCur(rt, true);
          if (mealPriceInRef == null && priceRow && priceWithMeal) {
            mealPriceInRef = parseFloat(priceWithMeal.amount) - parseFloat(priceRow.amount);
          }
        });
        const mealToSubtract = mealPriceInRef ?? (base.meta && typeof base.meta.meal_price === 'number' ? base.meta.meal_price : 0);
        ['single', 'double', 'triple', 'quad', 'quint'].forEach(rt => {
          const qty = Number(roomTypesMeta[rt]) || 0;
          const priceRow = byRoomRefCur(rt, false);
          const priceWithMeal = byRoomRefCur(rt, true);
          const basePrice = priceRow ? parseFloat(priceRow.amount) : (priceWithMeal ? Math.max(0, parseFloat(priceWithMeal.amount) - mealToSubtract) : 0);
          rooms[rt] = { quantity: qty, price: basePrice };
        });
        base.room_breakdown = rooms;
        base.prices_by_room = rooms;
        base.meal_price_idr = mealPriceInRef;
      }
      if (productType === 'visa') {
        const av = p.ProductAvailability;
        base.quota = av && av.quantity != null ? Number(av.quantity) : 0;
      }
      if (productType === 'ticket') {
        const av = p.ProductAvailability;
        const bandaraSchedules = (av?.meta && av.meta.bandara_schedules) ? av.meta.bandara_schedules : {};
        const prices = p.ProductPrices || [];
        const generalTicket = prices.filter(pr => !pr.branch_id && !pr.owner_id);
        const bandaraSeats = (av?.meta && av.meta.bandara_seats) ? av.meta.bandara_seats : {};
        base.bandara_options = BANDARA_TIKET.map(({ code, name }) => {
          const s = bandaraSchedules[code] || {};
          const defaultSlot = s.default || {};
          const priceRow = generalTicket.find(pr => pr.meta && pr.meta.bandara === code && pr.currency === refCur);
          if (priceRow && !defaultSlot.price_idr) defaultSlot.price_idr = parseFloat(priceRow.amount);
          if (bandaraSeats[code] != null && defaultSlot.seat_quota == null) defaultSlot.seat_quota = Number(bandaraSeats[code]) || 0;
          return {
            bandara: code,
            name,
            default: { price_idr: Number(defaultSlot.price_idr) || 0, seat_quota: Number(defaultSlot.seat_quota) || 0 },
            month: s.month && typeof s.month === 'object' ? s.month : {},
            week: s.week && typeof s.week === 'object' ? s.week : {},
            day: s.day && typeof s.day === 'object' ? s.day : {}
          };
        });
      }
      if (productType === 'bus') {
        const meta = base.meta && typeof base.meta === 'object' ? base.meta : {};
        const byTrip = meta.route_prices_by_trip && typeof meta.route_prices_by_trip === 'object' ? meta.route_prices_by_trip : {};
        const roundTrip = typeof byTrip.round_trip === 'number' && !Number.isNaN(byTrip.round_trip) ? Number(byTrip.round_trip) : 0;
        const oneWay = typeof byTrip.one_way === 'number' && !Number.isNaN(byTrip.one_way) ? Number(byTrip.one_way) : 0;
        const returnOnly = typeof byTrip.return_only === 'number' && !Number.isNaN(byTrip.return_only) ? Number(byTrip.return_only) : 0;
        const pricePerVehicleIdr = typeof meta.price_per_vehicle_idr === 'number' && !Number.isNaN(meta.price_per_vehicle_idr) ? Number(meta.price_per_vehicle_idr) : 0;
        base.meta = {
          ...meta,
          route_prices_by_trip: byTrip,
          route_prices: {
            full_route: roundTrip || oneWay || pricePerVehicleIdr,
            bandara_makkah: oneWay || roundTrip || pricePerVehicleIdr,
            bandara_madinah: oneWay || returnOnly || pricePerVehicleIdr,
            bandara_madinah_only: returnOnly || oneWay || pricePerVehicleIdr
          }
        };
        if ((base.price_general_idr == null || base.price_general_idr === 0) && (roundTrip > 0 || oneWay > 0 || returnOnly > 0)) {
          base.price_general_idr = roundTrip || oneWay || returnOnly;
        }
        if ((base.price_general_idr == null || base.price_general_idr === 0) && pricePerVehicleIdr > 0) {
          base.price_general_idr = pricePerVehicleIdr;
        }
      }
      return base;
    });
    const totalPages = Math.ceil(count / lim) || 1;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.json({
      success: true,
      data: result,
      pagination: { total: count, page: pg, limit: lim, totalPages }
    });
  }

  const totalPages = Math.ceil(count / lim) || 1;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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

/** Generate kode unik untuk product visa berdasarkan visa_kind (only, tasreh, premium) */
async function generateVisaCode(visaKind) {
  const suffix = (VISA_KIND_VALUES.includes(visaKind) ? visaKind.toUpperCase() : 'ONLY').slice(0, 7);
  const prefix = `VIS-${suffix}-`;
  const existing = await Product.findAll({
    where: { type: 'visa', code: { [Op.like]: `${prefix}%` } },
    attributes: ['code']
  });
  const nums = existing
    .map(p => parseInt(String(p.code || '').replace(prefix, '') || '0', 10))
    .filter(n => !Number.isNaN(n));
  const nextSeq = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

/**
 * POST /api/v1/products/visas - buat produk visa (Visa Only / Visa + Tasreh / Visa Premium)
 * Body: name, description?, visa_kind, require_hotel? (boolean, default false)
 */
const createVisa = asyncHandler(async (req, res) => {
  const { name, description, visa_kind, require_hotel, default_quota, currency } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'name wajib' });
  const kind = (visa_kind && VISA_KIND_VALUES.includes(visa_kind)) ? visa_kind : VISA_KIND.ONLY;
  const code = await generateVisaCode(kind);
  const meta = { visa_kind: kind, require_hotel: require_hotel === true || require_hotel === 'true' };
  const quotaNum = typeof default_quota === 'number' && !Number.isNaN(default_quota) && default_quota >= 0
    ? Math.round(default_quota)
    : (parseInt(default_quota, 10) >= 0 ? parseInt(default_quota, 10) : null);
  if (quotaNum != null) meta.default_quota = quotaNum;
  if (currency && ['IDR', 'SAR', 'USD'].includes(String(currency).toUpperCase())) meta.currency = String(currency).toUpperCase();
  const product = await Product.create({
    type: 'visa',
    code,
    name: name.trim(),
    description: description || null,
    is_package: false,
    meta,
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: product });
});

/** Generate kode unik untuk product tiket (TKT-001, TKT-002, ...) */
async function generateTicketCode() {
  const prefix = 'TKT-';
  const existing = await Product.findAll({
    where: { type: 'ticket', code: { [Op.like]: `${prefix}%` } },
    attributes: ['code']
  });
  const nums = existing
    .map(p => parseInt(String(p.code || '').replace(prefix, '') || '0', 10))
    .filter(n => !Number.isNaN(n));
  const nextSeq = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * POST /api/v1/products/tickets - buat produk tiket (workflow: pergi saja / pulang saja / pulang pergi)
 * Body: name, description?, trip_type? ('one_way' | 'return_only' | 'round_trip')
 */
const createTicket = asyncHandler(async (req, res) => {
  const { name, description, trip_type } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'name wajib' });
  const tripType = (trip_type && TICKET_TRIP_TYPES.includes(trip_type)) ? trip_type : 'round_trip';
  const code = await generateTicketCode();
  const product = await Product.create({
    type: 'ticket',
    code,
    name: name.trim(),
    description: description || null,
    is_package: false,
    meta: { trip_type: tripType },
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: product });
});

/** Generate kode unik untuk product bus (BUS-01, BUS-02, ...) */
async function generateBusCode() {
  const prefix = 'BUS-';
  const existing = await Product.findAll({
    where: { type: 'bus', code: { [Op.like]: `${prefix}%` } },
    attributes: ['code']
  });
  const nums = existing
    .map(p => parseInt(String(p.code || '').replace(prefix, '') || '0', 10))
    .filter(n => !Number.isNaN(n));
  const nextSeq = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return `${prefix}${String(nextSeq).padStart(2, '0')}`;
}

const BUS_KIND_VALUES = ['bus', 'hiace'];

/**
 * POST /api/v1/products/bus - buat produk bus atau hiace
 * Body: name, description?, bus_kind? ('bus' | 'hiace')
 *   - bus: route_prices_by_trip? { one_way?, return_only?, round_trip? } satu harga per tipe (IDR)
 *   - hiace: price_per_vehicle_idr? (harga per mobil)
 */
const PRICE_CURRENCY_VALUES = ['IDR', 'SAR', 'USD'];
const createBus = asyncHandler(async (req, res) => {
  const { name, description, bus_kind, route_prices_by_trip, price_per_vehicle_idr, default_quota, trip_type, price_currency } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'name wajib' });
  const kind = (bus_kind && BUS_KIND_VALUES.includes(bus_kind)) ? bus_kind : 'bus';
  const code = await generateBusCode();
  const meta = { bus_kind: kind };
  if (price_currency && PRICE_CURRENCY_VALUES.includes(String(price_currency).toUpperCase())) {
    meta.price_currency = String(price_currency).toUpperCase();
  }

  const quotaNum = typeof default_quota === 'number' && !Number.isNaN(default_quota) && default_quota >= 0
    ? Math.round(default_quota)
    : (parseInt(default_quota, 10) >= 0 ? parseInt(default_quota, 10) : null);
  if (quotaNum != null) meta.default_quota = quotaNum;

  if (kind === 'bus') {
    if (trip_type && BUS_TRIP_TYPES.includes(trip_type)) meta.trip_type = trip_type;
    if (route_prices_by_trip && typeof route_prices_by_trip === 'object') {
      meta.route_prices_by_trip = {};
      BUS_TRIP_TYPES.forEach(tt => {
        const v = route_prices_by_trip[tt];
        if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) meta.route_prices_by_trip[tt] = Math.round(v);
      });
    }
  } else {
    if (trip_type && BUS_TRIP_TYPES.includes(trip_type)) meta.trip_type = trip_type;
    const v = typeof price_per_vehicle_idr === 'number' && !Number.isNaN(price_per_vehicle_idr)
      ? Math.max(0, price_per_vehicle_idr)
      : (parseFloat(price_per_vehicle_idr) || 0);
    meta.price_per_vehicle_idr = Math.max(0, v);
  }

  const product = await Product.create({
    type: 'bus',
    code,
    name: name.trim(),
    description: description || null,
    is_package: false,
    meta,
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: product });
});

/**
 * PUT /api/v1/products/:id/ticket-bandara - set harga & kuota per bandara per periode
 * Body: { bandara, period_type: 'default'|'month'|'week'|'day', period_key?: string, price_idr, seat_quota }
 * period_key: month = '2026-01', week = '2026-01-13' (Senin), day = '2026-01-15'
 */
const setTicketBandara = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'ticket') return res.status(400).json({ success: false, message: 'Bukan product tiket' });

  const { bandara, period_type, period_key, price_idr, seat_quota } = req.body;
  if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
    return res.status(400).json({ success: false, message: 'bandara wajib: BTH, CGK, SBY, atau UPG' });
  }
  const pt = (period_type && TICKET_PERIOD_TYPES.includes(period_type)) ? period_type : 'default';
  const key = pt === 'default' ? 'default' : (period_key && String(period_key).trim()) || null;
  if (pt !== 'default' && !key) return res.status(400).json({ success: false, message: 'period_key wajib untuk month/week/day' });

  const priceIdr = Math.max(0, parseFloat(price_idr) || 0);
  const quota = Math.max(0, parseInt(seat_quota, 10) || 0);

  let av = await ProductAvailability.findOne({ where: { product_id: product.id } });
  const meta = av?.meta && typeof av.meta === 'object' ? { ...av.meta } : {};
  meta.bandara_schedules = meta.bandara_schedules || {};
  meta.bandara_schedules[bandara] = meta.bandara_schedules[bandara] || { default: { price_idr: 0, seat_quota: 0 }, month: {}, week: {}, day: {} };
  const s = meta.bandara_schedules[bandara];
  if (!s.month) s.month = {};
  if (!s.week) s.week = {};
  if (!s.day) s.day = {};

  if (pt === 'default') {
    s.default = { price_idr: priceIdr, seat_quota: quota };
  } else if (pt === 'month') {
    s.month[key] = { price_idr: priceIdr, seat_quota: quota };
  } else if (pt === 'week') {
    s.week[key] = { price_idr: priceIdr, seat_quota: quota };
  } else {
    s.day[key] = { price_idr: priceIdr, seat_quota: quota };
  }

  if (!av) {
    av = await ProductAvailability.create({
      product_id: product.id,
      quantity: 0,
      meta,
      updated_by: req.user.id
    });
  } else {
    av.meta = JSON.parse(JSON.stringify(meta));
    av.updated_by = req.user.id;
    av.changed('meta', true);
    await av.save();
  }

  res.json({ success: true, message: 'Harga dan kuota bandara disimpan' });
});

/**
 * PUT /api/v1/products/:id/ticket-bandara-bulk - set harga & kuota default untuk semua bandara sekaligus
 * Body: { bandara_defaults: { BTH: { price_idr?, seat_quota? }, CGK: {...}, SBY: {...}, UPG: {...} } }
 */
const setTicketBandaraBulk = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'ticket') return res.status(400).json({ success: false, message: 'Bukan product tiket' });

  const { bandara_defaults } = req.body;
  const defaults = bandara_defaults && typeof bandara_defaults === 'object' ? bandara_defaults : {};

  let av = await ProductAvailability.findOne({ where: { product_id: product.id } });
  const meta = av?.meta && typeof av.meta === 'object' ? { ...av.meta } : {};
  meta.bandara_schedules = meta.bandara_schedules && typeof meta.bandara_schedules === 'object' ? { ...meta.bandara_schedules } : {};

  for (const code of BANDARA_TIKET_CODES) {
    const def = defaults[code];
    const priceIdr = Math.max(0, parseFloat(def?.price_idr) || 0);
    const quota = Math.max(0, parseInt(def?.seat_quota, 10) || 0);
    meta.bandara_schedules[code] = meta.bandara_schedules[code] && typeof meta.bandara_schedules[code] === 'object'
      ? { ...meta.bandara_schedules[code] }
      : { default: { price_idr: 0, seat_quota: 0 }, month: {}, week: {}, day: {} };
    const s = meta.bandara_schedules[code];
    if (!s.month) s.month = {};
    if (!s.week) s.week = {};
    if (!s.day) s.day = {};
    s.default = { price_idr: priceIdr, seat_quota: quota };
  }

  if (!av) {
    av = await ProductAvailability.create({
      product_id: product.id,
      quantity: 0,
      meta,
      updated_by: req.user.id
    });
  } else {
    av.meta = JSON.parse(JSON.stringify(meta));
    av.updated_by = req.user.id;
    av.changed('meta', true);
    await av.save();
  }

  res.json({ success: true, message: 'Harga dan kuota semua bandara disimpan' });
});

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
  let finalMeta = meta && typeof meta === 'object' ? { ...meta } : {};
  if (type === 'visa') {
    const kind = (finalMeta.visa_kind && VISA_KIND_VALUES.includes(finalMeta.visa_kind)) ? finalMeta.visa_kind : VISA_KIND.ONLY;
    finalMeta.visa_kind = kind;
    if (typeof finalMeta.require_hotel !== 'boolean') finalMeta.require_hotel = finalMeta.require_hotel === true || finalMeta.require_hotel === 'true';
  }
  let finalCode = code;
  if (type === 'hotel' && (!finalCode || finalCode.trim() === '')) {
    const location = finalMeta.location || 'makkah';
    finalCode = await generateHotelCode(name, location);
  }
  if (type === 'visa' && (!finalCode || finalCode.trim() === '')) {
    finalCode = await generateVisaCode(finalMeta.visa_kind);
  }
  if (!finalCode || finalCode.trim() === '') return res.status(400).json({ success: false, message: 'code wajib' });
  const product = await Product.create({
    type, code: finalCode, name,
    description: description || null,
    is_package: !!is_package,
    meta: finalMeta,
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
  if (meta !== undefined) {
    const nextMeta = { ...(product.meta || {}), ...(meta && typeof meta === 'object' ? meta : {}) };
    if (product.type === 'visa') {
      if (nextMeta.visa_kind && !VISA_KIND_VALUES.includes(nextMeta.visa_kind)) nextMeta.visa_kind = VISA_KIND.ONLY;
      if (typeof nextMeta.require_hotel !== 'boolean') nextMeta.require_hotel = nextMeta.require_hotel === true || nextMeta.require_hotel === 'true';
      if (nextMeta.hasOwnProperty('default_quota')) {
        if (nextMeta.default_quota === null || nextMeta.default_quota === '') delete nextMeta.default_quota;
        else { const q = parseInt(nextMeta.default_quota, 10); nextMeta.default_quota = (Number.isNaN(q) || q < 0) ? 0 : Math.round(q); }
      }
    }
    if (product.type === 'ticket' && nextMeta.trip_type && !TICKET_TRIP_TYPES.includes(nextMeta.trip_type)) {
      nextMeta.trip_type = 'round_trip';
    }
    if (product.type === 'bus') {
      if (nextMeta.bus_kind && !BUS_KIND_VALUES.includes(nextMeta.bus_kind)) nextMeta.bus_kind = 'bus';
      if (nextMeta.route_prices_by_trip && typeof nextMeta.route_prices_by_trip === 'object') {
        const sanitized = {};
        BUS_TRIP_TYPES.forEach(tt => {
          const v = nextMeta.route_prices_by_trip[tt];
          if (typeof v === 'number' && !isNaN(v) && v >= 0) sanitized[tt] = Math.round(v);
        });
        nextMeta.route_prices_by_trip = sanitized;
      }
      if (nextMeta.trip_type && BUS_TRIP_TYPES.includes(nextMeta.trip_type)) nextMeta.trip_type = nextMeta.trip_type;
      if (nextMeta.bus_kind === 'hiace' && nextMeta.price_per_vehicle_idr != null) {
        nextMeta.price_per_vehicle_idr = Math.max(0, parseFloat(nextMeta.price_per_vehicle_idr) || 0);
      }
      if (nextMeta.hasOwnProperty('default_quota')) {
        if (nextMeta.default_quota === null || nextMeta.default_quota === '') delete nextMeta.default_quota;
        else { const q = parseInt(nextMeta.default_quota, 10); nextMeta.default_quota = (Number.isNaN(q) || q < 0) ? 0 : Math.round(q); }
      }
      if (nextMeta.price_currency && PRICE_CURRENCY_VALUES.includes(String(nextMeta.price_currency).toUpperCase())) {
        nextMeta.price_currency = String(nextMeta.price_currency).toUpperCase();
      }
    }
    product.meta = nextMeta;
  }
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
  const branchId = branch_id || (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.ADMIN_PUSAT && req.user.role !== ROLES.ROLE_ACCOUNTING ? req.user.branch_id : null);
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
  const { product_id, branch_id, owner_id, currency, amount, amount_idr, amount_sar, amount_usd, reference_currency, meta, effective_from, effective_until } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id wajib' });

  const canSetBranch = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING].includes(req.user.role);
  const canSetOwner = [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI].includes(req.user.role);

  let finalBranchId = branch_id || null;
  let finalOwnerId = owner_id || null;

  if (finalBranchId && !canSetBranch) finalBranchId = null;
  if (finalOwnerId && !canSetOwner) finalOwnerId = null;
  if ((req.user.role === ROLES.INVOICE_KOORDINATOR || req.user.role === ROLES.ROLE_INVOICE_SAUDI) && finalBranchId !== req.user.branch_id) finalBranchId = req.user.branch_id;

  const metaObj = meta && typeof meta === 'object' ? meta : {};
  const hasMulti = amount_idr != null || amount_sar != null || amount_usd != null;
  const hasSimple = currency != null && amount != null;
  const isEmptyMeta = !metaObj || Object.keys(metaObj).length === 0;

  if (hasMulti) {
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

    let refCur = (reference_currency === 'SAR' || reference_currency === 'USD') ? reference_currency : null;
    if (!refCur && amount_sar != null && amount_idr == null && amount_usd == null) refCur = 'SAR';
    else if (!refCur && amount_usd != null && amount_idr == null && amount_sar == null) refCur = 'USD';
    if (!refCur) refCur = 'IDR';
    const mergedMeta = isEmptyMeta ? { reference_currency: refCur } : { ...metaObj, reference_currency: refCur };

    const existing = await ProductPrice.findAll({
      where: { product_id, branch_id: finalBranchId, owner_id: finalOwnerId }
    });
    const toDelete = isEmptyMeta
      ? existing.filter(pr => !pr.meta || Object.keys(pr.meta || {}).length === 0)
      : existing.filter(pr => {
          const m = pr.meta && typeof pr.meta === 'object' ? pr.meta : {};
          return Object.keys(metaObj).every(k => m[k] === metaObj[k]);
        });
    for (const pr of toDelete) await pr.destroy();

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
        meta: mergedMeta,
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

  if (!hasSimple) return res.status(400).json({ success: false, message: 'Berikan currency + amount, atau amount_idr/amount_sar/amount_usd' });

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

/**
 * GET /api/v1/products/:id/hotel-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Kalender hotel: per tanggal ada availability per room type + daftar booking (owner, jamaah per room type). Hanya product type hotel.
 */
const getHotelCalendarHandler = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, { attributes: ['id', 'type', 'name'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const data = await getHotelCalendar(product.id, from, to);
  res.json({ success: true, data: { ...data, productName: product.name } });
});

/**
 * GET /api/v1/products/:id/visa-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Kalender visa: per tanggal ada kuota, booked, available, daftar booking. Hanya product type visa.
 */
const getVisaCalendarHandler = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, { attributes: ['id', 'type', 'name', 'meta'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'visa') return res.status(400).json({ success: false, message: 'Bukan product visa' });
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  // Gunakan meta.default_quota jika ada; jika tidak ada, fallback ke ProductAvailability.quantity
  const baseMeta = product.meta && typeof product.meta === 'object' ? { ...product.meta } : {};
  if (baseMeta.default_quota == null || typeof baseMeta.default_quota !== 'number') {
    const availability = await ProductAvailability.findOne({
      where: { product_id: product.id },
      attributes: ['quantity']
    });
    if (availability && typeof availability.quantity === 'number' && availability.quantity >= 0) {
      baseMeta.default_quota = availability.quantity;
    }
  }
  const productMeta = Object.keys(baseMeta).length > 0 ? baseMeta : null;
  const data = await getVisaCalendar(product.id, from, to, productMeta);
  res.json({ success: true, data: { ...data, productName: product.name } });
});

/**
 * GET /api/v1/products/:id/bus-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Kalender bus: per tanggal ada kuota, booked, available, daftar booking. Hanya product type bus.
 */
const getBusCalendarHandler = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, { attributes: ['id', 'type', 'name', 'meta'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'bus') return res.status(400).json({ success: false, message: 'Bukan product bus' });
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const productMeta = product.meta && typeof product.meta === 'object' ? product.meta : null;
  const data = await getBusCalendar(product.id, from, to, productMeta);
  res.json({ success: true, data: { ...data, productName: product.name } });
});

/**
 * GET /api/v1/products/:id/ticket-calendar?bandara=BTH|CGK|SBY|UPG&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Kalender tiket: per tanggal ada kuota, booked, available, daftar booking (per bandara). Hanya product type ticket.
 */
const getTicketCalendarHandler = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.id, { attributes: ['id', 'type', 'name'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'ticket') return res.status(400).json({ success: false, message: 'Bukan product tiket' });
  const bandara = req.query.bandara;
  if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
    return res.status(400).json({ success: false, message: 'Query bandara wajib: BTH, CGK, SBY, atau UPG' });
  }
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const data = await getTicketCalendar(product.id, bandara, from, to);
  res.json({ success: true, data: { ...data, productName: product.name, bandara } });
});

module.exports = {
  list,
  getById,
  getPrice,
  getAvailability,
  getHotelCalendar: getHotelCalendarHandler,
  getVisaCalendar: getVisaCalendarHandler,
  getBusCalendar: getBusCalendarHandler,
  getTicketCalendar: getTicketCalendarHandler,
  create,
  createHotel,
  createVisa,
  createTicket,
  createBus,
  setTicketBandara,
  setTicketBandaraBulk,
  update,
  remove,
  listPrices,
  createPrice,
  updatePrice,
  deletePrice,
  getEffectivePrice
};
