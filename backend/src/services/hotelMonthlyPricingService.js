const { Op } = require('sequelize');
const { HotelMonthlyPrice, ProductPrice } = require('../models');

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
  roomType,
  withMeal,
  currency
}) {
  const room = roomType || 'single';
  const cur = String(currency || 'IDR').toUpperCase();
  const layers = [
    { branch_id: branchId || null, owner_id: ownerId || null },
    { branch_id: branchId || null, owner_id: null },
    { branch_id: null, owner_id: null }
  ];
  for (const layer of layers) {
    const row = await HotelMonthlyPrice.findOne({
      where: {
        product_id: productId,
        year_month: yearMonth,
        currency: cur,
        room_type: room,
        with_meal: !!withMeal,
        branch_id: layer.branch_id,
        owner_id: layer.owner_id
      },
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']]
    });
    if (row) return row;
  }
  return null;
}

async function findFallbackDefaultPrice({
  productId,
  branchId,
  ownerId,
  roomType,
  withMeal,
  currency
}) {
  const room = roomType || 'single';
  const cur = String(currency || 'IDR').toUpperCase();
  const layers = [
    { branch_id: branchId || null, owner_id: ownerId || null },
    { branch_id: branchId || null, owner_id: null },
    { branch_id: null, owner_id: null }
  ];
  for (const layer of layers) {
    const row = await ProductPrice.findOne({
      where: {
        product_id: productId,
        currency: cur,
        branch_id: layer.branch_id,
        owner_id: layer.owner_id,
        [Op.or]: [
          { meta: { room_type: room, with_meal: !!withMeal } },
          { meta: { room_type: room } }
        ]
      },
      order: [['created_at', 'DESC']]
    });
    if (row) return row;
  }
  return null;
}

async function calculateStayCostByNights({
  productId,
  branchId,
  ownerId,
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
      unit_price_in_currency: 0,
      breakdown: [],
      used_fallback_default: false
    };
  }

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const cur = String(currency || 'IDR').toUpperCase();
  let subtotalIdr = 0;
  const breakdown = [];
  let usedFallback = false;

  for (const night of nights) {
    const yearMonth = toYearMonth(night);
    let source = 'monthly';
    let row = await findMonthlyPrice({
      productId,
      yearMonth,
      branchId,
      ownerId,
      roomType,
      withMeal,
      currency: cur
    });
    if (!row) {
      source = 'fallback_default';
      row = await findFallbackDefaultPrice({
        productId,
        branchId,
        ownerId,
        roomType,
        withMeal,
        currency: cur
      });
      usedFallback = true;
    }

    const amountInCur = Number(row?.amount) || 0;
    const amountIdr = amountToIdr(amountInCur, cur, rates);
    subtotalIdr += amountIdr * qty;
    breakdown.push({
      date: night.toISOString().slice(0, 10),
      year_month: yearMonth,
      amount: amountInCur,
      currency: cur,
      amount_idr: amountIdr,
      source
    });
  }

  const unitPerNightInCur = idrToCurrency(subtotalIdr / (qty * nights.length), cur, rates);
  return {
    nights: nights.length,
    subtotal_idr: subtotalIdr,
    unit_price_in_currency: unitPerNightInCur,
    breakdown,
    used_fallback_default: usedFallback
  };
}

module.exports = {
  calculateStayCostByNights,
  enumerateNights,
  toYearMonth
};

