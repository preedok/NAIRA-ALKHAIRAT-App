const { Op, QueryTypes } = require('sequelize');
const { HotelMonthlyPrice, Product, OwnerProfile } = require('../models');
const { ROOM_CAPACITY } = require('../constants');

const MEAL_ROOM_TYPE = '__meal__';
const COMPONENT_ROOM = 'room';
const COMPONENT_MEAL = 'meal';
let ownerTypeScopeColumnExistsCache = null;

async function hasOwnerTypeScopeColumn() {
  if (ownerTypeScopeColumnExistsCache != null) return ownerTypeScopeColumnExistsCache;
  try {
    const rows = await HotelMonthlyPrice.sequelize.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'hotel_monthly_prices'
         AND column_name = 'owner_type_scope'
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    ownerTypeScopeColumnExistsCache = Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    ownerTypeScopeColumnExistsCache = false;
  }
  return ownerTypeScopeColumnExistsCache;
}

function toDateOnly(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYearMonth(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function enumerateNights(checkIn, checkOut) {
  const start = toDateOnly(checkIn);
  const end = toDateOnly(checkOut);
  if (!start || !end || end <= start) return [];
  const out = [];
  const cur = new Date(start.getTime());
  while (cur < end) {
    out.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function amountToIdr(amount, currency, rates) {
  const n = Number(amount) || 0;
  const cur = String(currency || 'IDR').toUpperCase();
  const sar = Number(rates?.SAR_TO_IDR) || 4200;
  const usd = Number(rates?.USD_TO_IDR) || 15500;
  if (cur === 'SAR') return n * sar;
  if (cur === 'USD') return n * usd;
  return n;
}

function idrToCurrency(idr, currency, rates) {
  const n = Number(idr) || 0;
  const cur = String(currency || 'IDR').toUpperCase();
  const sar = Number(rates?.SAR_TO_IDR) || 4200;
  const usd = Number(rates?.USD_TO_IDR) || 15500;
  if (cur === 'SAR') return n / sar;
  if (cur === 'USD') return n / usd;
  return n;
}

async function findMonthlyPrice({
  productId,
  yearMonth,
  branchId,
  ownerId,
  ownerTypeScope,
  roomType,
  withMeal,
  currency,
  component = COMPONENT_ROOM
}) {
  const supportsOwnerTypeScope = await hasOwnerTypeScopeColumn();
  const isMeal = component === COMPONENT_MEAL;
  const room = isMeal ? MEAL_ROOM_TYPE : (roomType || 'double');
  const withMealFlag = isMeal ? false : !!withMeal;
  const cur = String(currency || 'IDR').toUpperCase();
  /** Baris __meal__ lama bisa punya component default 'room' (satu migrasi); terima keduanya untuk lookup. */
  const componentFilter = isMeal
    ? { component: { [Op.in]: [COMPONENT_MEAL, COMPONENT_ROOM] } }
    : { component: COMPONENT_ROOM };
  const layers = [
    { branch_id: branchId || null, owner_id: ownerId || null },
    { branch_id: branchId || null, owner_id: null },
    { branch_id: null, owner_id: null }
  ];
  const ownerScope = ownerTypeScope === 'mou' || ownerTypeScope === 'non_mou' ? ownerTypeScope : null;
  const ownerScopeCandidates = supportsOwnerTypeScope
    ? (ownerScope ? [ownerScope, 'all'] : ['all'])
    : [null];
  for (const layer of layers) {
    for (const scope of ownerScopeCandidates) {
      const ownerScopeFilter = supportsOwnerTypeScope ? { owner_type_scope: scope || 'all' } : {};
      const row = await HotelMonthlyPrice.findOne({
        where: {
          product_id: productId,
          year_month: yearMonth,
          currency: cur,
          room_type: room,
          with_meal: withMealFlag,
          branch_id: layer.branch_id,
          owner_id: layer.owner_id,
          ...ownerScopeFilter,
          ...componentFilter
        },
        ...(supportsOwnerTypeScope ? {} : { attributes: { exclude: ['owner_type_scope'] } }),
        order: [['updated_at', 'DESC'], ['created_at', 'DESC']]
      });
      if (row) return row;
    }
  }
  return null;
}

async function findMonthlyPriceRowForOrder({
  productId,
  yearMonth,
  branchId,
  ownerId,
  ownerTypeScope,
  roomType,
  withMeal,
  orderCurrency,
  component = COMPONENT_ROOM
}) {
  const cur = String(orderCurrency || 'IDR').toUpperCase();
  let row = await findMonthlyPrice({
    productId,
    yearMonth,
    branchId,
    ownerId,
    ownerTypeScope,
    roomType,
    withMeal,
    currency: cur,
    component
  });
  if (row) return { row, amountCurrency: cur };
  if (cur !== 'SAR') {
    row = await findMonthlyPrice({
      productId,
      yearMonth,
      branchId,
      ownerId,
      ownerTypeScope,
      roomType,
      withMeal,
      currency: 'SAR',
      component
    });
    if (row) return { row, amountCurrency: 'SAR' };
  }
  return { row: null, amountCurrency: cur };
}

async function findMonthlyMealRowForOrder({
  productId,
  yearMonth,
  branchId,
  ownerId,
  ownerTypeScope,
  orderCurrency
}) {
  return findMonthlyPriceRowForOrder({
    productId,
    yearMonth,
    branchId,
    ownerId,
    ownerTypeScope,
    roomType: MEAL_ROOM_TYPE,
    withMeal: false,
    orderCurrency,
    component: COMPONENT_MEAL
  });
}

/**
 * Harga menginap: kamar dari grid bulanan (component room) + opsional makan (component meal) untuk room_only.
 */
async function calculateStayCostByNights({
  productId,
  branchId,
  ownerId,
  ownerTypeScope,
  roomType,
  withMeal,
  checkIn,
  checkOut,
  quantity,
  currency,
  rates
}) {
  const nights = enumerateNights(checkIn, checkOut);
  if (!nights.length) {
    return {
      nights: 0,
      subtotal_idr: 0,
      room_subtotal_idr: 0,
      meal_subtotal_idr: 0,
      unit_price_in_currency: 0,
      room_unit_per_night_in_currency: 0,
      meal_unit_per_person_per_night_in_currency: 0,
      breakdown: [],
      used_fallback_default: false
    };
  }

  const product = await Product.findByPk(productId, { attributes: ['id', 'meta'] });
  const meta = product && product.meta && typeof product.meta === 'object' ? product.meta : {};
  const mealPlan = meta.meal_plan === 'fullboard' ? 'fullboard' : 'room_only';

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const cur = String(currency || 'IDR').toUpperCase();
  const rt = roomType || 'double';
  const cap = Number(ROOM_CAPACITY[rt]) || 1;
  let resolvedOwnerTypeScope = ownerTypeScope === 'mou' || ownerTypeScope === 'non_mou' ? ownerTypeScope : null;
  if (!resolvedOwnerTypeScope && ownerId) {
    const profile = await OwnerProfile.findOne({ where: { user_id: ownerId }, attributes: ['is_mou_owner'], raw: true });
    resolvedOwnerTypeScope = profile && profile.is_mou_owner ? 'mou' : 'non_mou';
  }

  let roomSubtotalIdr = 0;
  let mealSubtotalIdr = 0;
  const breakdown = [];

  /** Untuk baris kamar: with_meal di DB bulanan (fullboard = true = paket) */
  const roomMonthlyWithMeal = mealPlan === 'fullboard' && !!withMeal;

  for (const night of nights) {
    const yearMonth = toYearMonth(night);
    let source = 'monthly_room';
    let row = null;
    let amountCurrency = cur;
    const found = await findMonthlyPriceRowForOrder({
      productId,
      yearMonth,
      branchId,
      ownerId,
      ownerTypeScope: resolvedOwnerTypeScope,
      roomType: rt,
      withMeal: roomMonthlyWithMeal,
      orderCurrency: cur,
      component: COMPONENT_ROOM
    });
    row = found.row;
    amountCurrency = found.amountCurrency;
    if (!row) {
      const err = new Error(
        `Tarif kamar belum di grid bulanan SAR untuk bulan ${yearMonth} (malam ${night.toISOString().slice(0, 10)}). Isi Pengaturan Jumlah Kamar → tarif per malam per bulan.`
      );
      err.code = 'MISSING_HOTEL_MONTHLY_ROOM';
      throw err;
    }

    const amountInStoredCur = Number(row?.amount) || 0;
    const roomNightIdr = amountToIdr(amountInStoredCur, amountCurrency, rates);
    roomSubtotalIdr += roomNightIdr * qty;
    breakdown.push({
      date: night.toISOString().slice(0, 10),
      year_month: yearMonth,
      kind: 'room',
      amount: amountInStoredCur,
      currency: amountCurrency,
      amount_idr: roomNightIdr,
      source
    });

    if (mealPlan === 'room_only' && withMeal) {
      let mealSource = 'monthly_meal';
      const mf = await findMonthlyMealRowForOrder({
        productId,
        yearMonth,
        branchId,
        ownerId,
        ownerTypeScope: resolvedOwnerTypeScope,
        orderCurrency: cur
      });
      const mealAmt = mf.row ? Number(mf.row.amount) || 0 : 0;
      const mealCur = mf.amountCurrency;
      if (!mf.row || mealAmt <= 0) {
        const err = new Error(
          `Harga makan belum di grid bulanan SAR untuk bulan ${yearMonth} (malam ${night.toISOString().slice(0, 10)}). Isi baris makan per bulan (room only).`
        );
        err.code = 'MISSING_HOTEL_MONTHLY_MEAL';
        throw err;
      }
      const mealNightIdr = amountToIdr(mealAmt, mealCur, rates);
      mealSubtotalIdr += mealNightIdr * cap * qty;
      breakdown.push({
        date: night.toISOString().slice(0, 10),
        year_month: yearMonth,
        kind: 'meal',
        amount: mealAmt,
        currency: mealCur,
        amount_idr: mealNightIdr,
        pax_multiplier: cap * qty,
        source: mealSource
      });
    }
  }

  const subtotalIdr = roomSubtotalIdr + mealSubtotalIdr;
  const denom = qty * nights.length;
  const unitPerNightInCur = denom > 0 ? idrToCurrency(subtotalIdr / denom, cur, rates) : 0;
  const roomUnitPerNightInCur = denom > 0 ? idrToCurrency(roomSubtotalIdr / denom, cur, rates) : 0;
  const mealPersonNights = mealPlan === 'room_only' && withMeal ? cap * qty * nights.length : 0;
  const mealUnitPerPersonPerNightInCur = mealPersonNights > 0
    ? idrToCurrency(mealSubtotalIdr / mealPersonNights, cur, rates)
    : 0;

  return {
    nights: nights.length,
    subtotal_idr: subtotalIdr,
    room_subtotal_idr: roomSubtotalIdr,
    meal_subtotal_idr: mealSubtotalIdr,
    unit_price_in_currency: unitPerNightInCur,
    room_unit_per_night_in_currency: roomUnitPerNightInCur,
    meal_unit_per_person_per_night_in_currency: mealUnitPerPersonPerNightInCur,
    breakdown,
    used_fallback_default: false
  };
}

module.exports = {
  calculateStayCostByNights,
  enumerateNights,
  toYearMonth,
  findMonthlyPriceRowForOrder,
  findMonthlyMealRowForOrder,
  COMPONENT_ROOM,
  COMPONENT_MEAL,
  MEAL_ROOM_TYPE
};
