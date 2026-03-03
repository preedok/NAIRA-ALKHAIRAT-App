/**
 * Setelah kurs (currency_rates) diubah di business rules, semua harga di product_prices
 * disesuaikan: nilai kanonik IDR tetap, amount SAR dan USD di-update sesuai kurs baru.
 * Jika hanya ada satu mata uang, nilai dijadikan referensi IDR lalu triple IDR/SAR/USD diisi.
 */
const { ProductPrice } = require('../models');

const CURRENCIES = ['IDR', 'SAR', 'USD'];

function metaKey(meta) {
  if (meta == null || (typeof meta === 'object' && Object.keys(meta).length === 0)) return '';
  const sorted = Object.keys(meta).sort().reduce((acc, k) => { acc[k] = meta[k]; return acc; }, {});
  return JSON.stringify(sorted);
}

function normalizeMeta(meta) {
  if (meta == null) return {};
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta;
  return {};
}

/**
 * Recalculate all product_prices so that IDR/SAR/USD amounts are consistent with the new rates.
 * @param {object} rates - { SAR_TO_IDR: number, USD_TO_IDR: number }
 * @returns {Promise<{ updated: number, created: number }>}
 */
async function recalcProductPricesByRates(rates) {
  const SAR_TO_IDR = typeof rates.SAR_TO_IDR === 'number' && rates.SAR_TO_IDR > 0 ? rates.SAR_TO_IDR : 4200;
  const USD_TO_IDR = typeof rates.USD_TO_IDR === 'number' && rates.USD_TO_IDR > 0 ? rates.USD_TO_IDR : 15500;

  const all = await ProductPrice.findAll({ order: [['product_id'], ['branch_id'], ['owner_id']], raw: true });
  const groups = new Map();
  for (const row of all) {
    const key = `${row.product_id}|${row.branch_id ?? 'null'}|${row.owner_id ?? 'null'}|${metaKey(row.meta)}`;
    if (!groups.has(key)) groups.set(key, { product_id: row.product_id, branch_id: row.branch_id, owner_id: row.owner_id, meta: row.meta || {}, rows: [] });
    groups.get(key).rows.push(row);
  }

  let updated = 0;
  let created = 0;

  for (const [, group] of groups) {
    const byCur = {};
    for (const r of group.rows) byCur[r.currency] = r;

    let idr = null;
    if (byCur.IDR && byCur.IDR.amount != null) idr = parseFloat(byCur.IDR.amount);
    else if (byCur.SAR && byCur.SAR.amount != null) idr = parseFloat(byCur.SAR.amount) * SAR_TO_IDR;
    else if (byCur.USD && byCur.USD.amount != null) idr = parseFloat(byCur.USD.amount) * USD_TO_IDR;

    if (idr == null || Number.isNaN(idr)) continue;

    const amounts = {
      IDR: idr,
      SAR: idr / SAR_TO_IDR,
      USD: idr / USD_TO_IDR
    };

    for (const cur of CURRENCIES) {
      const amt = amounts[cur];
      const existing = byCur[cur];
      if (existing) {
        await ProductPrice.update(
          { amount: amt },
          { where: { id: existing.id } }
        );
        updated++;
      } else {
        await ProductPrice.create({
          product_id: group.product_id,
          branch_id: group.branch_id,
          owner_id: group.owner_id,
          currency: cur,
          amount: amt,
          meta: normalizeMeta(group.meta)
        });
        created++;
      }
    }
  }

  return { updated, created };
}

module.exports = { recalcProductPricesByRates };
