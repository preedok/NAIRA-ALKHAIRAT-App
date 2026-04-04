/**
 * Isi / perbarui hotel_monthly_prices (grid bulanan SAR, pusat) dari:
 * - product_prices (branch_id & owner_id NULL): harga per tipe kamar + with_meal
 * - products.meta.meal_price + meta.currency (room only): baris __meal__
 *
 * Konversi ke SAR memakai business_rules currency_rates (fallback SAR_TO_IDR 4200, USD_TO_IDR 15500).
 *
 * Jalankan dari folder backend:
 *   node scripts/backfill-hotel-monthly-from-prices.js
 *   node scripts/backfill-hotel-monthly-from-prices.js --year=2026
 *   node scripts/backfill-hotel-monthly-from-prices.js --dry-run
 *   node scripts/backfill-hotel-monthly-from-prices.js --product-id=<uuid>
 */
require('dotenv').config();
const path = require('path');
const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const { Product, ProductPrice, BusinessRuleConfig } = require(path.join(__dirname, '../src/models'));
const { BUSINESS_RULE_KEYS } = require(path.join(__dirname, '../src/constants'));
const HotelMonthlyPrice = require(path.join(__dirname, '../src/models/HotelMonthlyPrice'));

const MEAL_ROOM_TYPE = '__meal__';
const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'];

function parseArgs() {
  const out = { year: String(new Date().getFullYear()), dryRun: false, productId: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--year=')) out.year = a.slice(7).trim();
    else if (a.startsWith('--product-id=')) out.productId = a.slice(13).trim() || null;
  }
  if (!/^\d{4}$/.test(out.year)) {
    console.error('Invalid --year, use YYYY');
    process.exit(1);
  }
  return out;
}

function monthKeys(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

async function loadRates() {
  const row = await BusinessRuleConfig.findOne({
    where: { key: BUSINESS_RULE_KEYS.CURRENCY_RATES, branch_id: null },
    raw: true
  });
  let cr = row?.value;
  if (typeof cr === 'string') {
    try {
      cr = JSON.parse(cr);
    } catch {
      cr = null;
    }
  }
  const SAR_TO_IDR = (cr && typeof cr.SAR_TO_IDR === 'number') ? cr.SAR_TO_IDR : 4200;
  const USD_TO_IDR = (cr && typeof cr.USD_TO_IDR === 'number') ? cr.USD_TO_IDR : 15500;
  return { SAR_TO_IDR, USD_TO_IDR };
}

function amountToSar(amount, currency, rates) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  const cur = String(currency || 'IDR').toUpperCase();
  if (cur === 'SAR') return Math.round(n * 100) / 100;
  if (cur === 'IDR') return Math.round((n / rates.SAR_TO_IDR) * 100) / 100;
  if (cur === 'USD') return Math.round(((n * rates.USD_TO_IDR) / rates.SAR_TO_IDR) * 100) / 100;
  return null;
}

async function setMealComponentIfColumnExists(rowId) {
  try {
    await sequelize.query(`UPDATE hotel_monthly_prices SET component = 'meal' WHERE id = :id`, {
      replacements: { id: rowId }
    });
  } catch (e) {
    if (!String(e.message || '').includes('component')) throw e;
  }
}

async function upsertMonthlyRow(
  { product_id, year_month, room_type, with_meal, amountSar },
  dryRun
) {
  if (amountSar == null || amountSar <= 0) return { skipped: true };
  if (dryRun) {
    return { dry: true, product_id, year_month, room_type, with_meal, amountSar };
  }
  let row = await HotelMonthlyPrice.findOne({
    where: {
      product_id,
      year_month,
      currency: 'SAR',
      room_type,
      with_meal,
      branch_id: null,
      owner_id: null
    }
  });
  if (row) {
    row.amount = amountSar;
    await row.save();
  } else {
    row = await HotelMonthlyPrice.create({
      product_id,
      branch_id: null,
      owner_id: null,
      year_month,
      currency: 'SAR',
      room_type,
      with_meal,
      amount: amountSar
    });
  }
  if (room_type === MEAL_ROOM_TYPE) await setMealComponentIfColumnExists(row.id);
  return { ok: true };
}

async function main() {
  const { year, dryRun, productId } = parseArgs();
  const rates = await loadRates();
  const months = monthKeys(year);

  const whereProduct = { type: 'hotel', is_active: true };
  if (productId) whereProduct.id = productId;

  const hotels = await Product.findAll({
    where: whereProduct,
    attributes: ['id', 'name', 'code', 'meta'],
    include: [
      {
        model: ProductPrice,
        as: 'ProductPrices',
        required: false,
        where: { branch_id: null, owner_id: null }
      }
    ]
  });

  let written = 0;
  let skippedHotels = 0;

  for (const p of hotels) {
    const meta = p.meta && typeof p.meta === 'object' ? p.meta : {};
    const mealPlan = meta.meal_plan === 'fullboard' ? 'fullboard' : 'room_only';
    const pricingMode = meta.pricing_mode === 'single' ? 'single' : 'per_type';
    const prices = (p.ProductPrices || []).slice().sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at).getTime();
      const tb = new Date(b.updated_at || b.created_at).getTime();
      return ta - tb;
    });

    /** @type {Map<string, number>} key: `${roomType}|${withMeal}` → SAR */
    const sarMap = new Map();

    for (const pp of prices) {
      const m = pp.meta && typeof pp.meta === 'object' ? pp.meta : {};
      const rt = String(m.room_type || 'single').toLowerCase();
      if (!ROOM_TYPES.includes(rt)) continue;
      const wm = !!m.with_meal;
      const sar = amountToSar(pp.amount, pp.currency, rates);
      if (sar == null || sar <= 0) continue;
      sarMap.set(`${rt}|${wm}`, sar);
    }

    if (pricingMode === 'single') {
      let repSarRoom = null;
      let repSarBundle = null;
      for (const rt of ROOM_TYPES) {
        if (repSarRoom == null && sarMap.has(`${rt}|false`)) repSarRoom = sarMap.get(`${rt}|false`);
        if (repSarBundle == null && sarMap.has(`${rt}|true`)) repSarBundle = sarMap.get(`${rt}|true`);
      }
      if (repSarRoom == null) {
        for (const rt of ROOM_TYPES) {
          if (sarMap.has(`${rt}|false`)) {
            repSarRoom = sarMap.get(`${rt}|false`);
            break;
          }
        }
      }
      if (repSarBundle == null) {
        for (const rt of ROOM_TYPES) {
          if (sarMap.has(`${rt}|true`)) {
            repSarBundle = sarMap.get(`${rt}|true`);
            break;
          }
        }
      }
      sarMap.clear();
      if (mealPlan === 'fullboard') {
        const v = repSarBundle ?? repSarRoom;
        if (v != null) ROOM_TYPES.forEach((rt) => sarMap.set(`${rt}|true`, v));
      } else {
        if (repSarRoom != null) ROOM_TYPES.forEach((rt) => sarMap.set(`${rt}|false`, repSarRoom));
        if (repSarBundle != null) ROOM_TYPES.forEach((rt) => sarMap.set(`${rt}|true`, repSarBundle));
      }
    }

    let mealSar = null;
    if (mealPlan === 'room_only') {
      const mp = Number(meta.meal_price);
      if (Number.isFinite(mp) && mp > 0) {
        mealSar = amountToSar(mp, meta.currency || 'SAR', rates);
      }
    }

    if (sarMap.size === 0 && (mealSar == null || mealSar <= 0)) {
      skippedHotels += 1;
      continue;
    }

    for (const ym of months) {
      for (const rt of ROOM_TYPES) {
        if (mealPlan === 'fullboard') {
          const sar = sarMap.get(`${rt}|true`);
          if (sar != null && sar > 0) {
            const r = await upsertMonthlyRow(
              { product_id: p.id, year_month: ym, room_type: rt, with_meal: true, amountSar: sar },
              dryRun
            );
            if (r.ok || r.dry) written += 1;
          }
        } else {
          const sar = sarMap.get(`${rt}|false`);
          if (sar != null && sar > 0) {
            const r = await upsertMonthlyRow(
              { product_id: p.id, year_month: ym, room_type: rt, with_meal: false, amountSar: sar },
              dryRun
            );
            if (r.ok || r.dry) written += 1;
          }
        }
      }
      if (mealSar != null && mealSar > 0) {
        const r = await upsertMonthlyRow(
          {
            product_id: p.id,
            year_month: ym,
            room_type: MEAL_ROOM_TYPE,
            with_meal: false,
            amountSar: mealSar
          },
          dryRun
        );
        if (r.ok || r.dry) written += 1;
      }
    }

    if (dryRun && (sarMap.size > 0 || mealSar)) {
      console.log(
        `[dry-run] ${p.code || p.id} ${p.name}: months=${months.length}, room keys=${sarMap.size}, mealSAR=${mealSar ?? '-'}`
      );
    }
  }

  console.log(
    dryRun
      ? `\nDry-run selesai. Akan menulis ±${written} sel bulanan (hitungan upsert). Hotel tanpa sumber harga: ${skippedHotels}.`
      : `\nSelesai. Operasi upsert: ${written}. Hotel dilewati (tanpa product_prices / meal meta): ${skippedHotels}.`
  );
  console.log(`Tahun: ${year}, SAR_TO_IDR=${rates.SAR_TO_IDR}, USD_TO_IDR=${rates.USD_TO_IDR}`);

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  sequelize.close().catch(() => {});
  process.exit(1);
});
