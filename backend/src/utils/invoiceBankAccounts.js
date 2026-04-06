/**
 * Rekening tujuan transfer invoice (Nabiela / siskopatuh vs rekening lain).
 * Dipakai GET invoice, PDF, dan email.
 */
const { ORDER_ITEM_TYPE } = require('../constants');

function normalizeAccountNumberDigits(n) {
  return String(n || '').replace(/\D/g, '');
}

/**
 * Rekening khusus bagian siskopatuh (Mandiri / NABIELA — identifikasi lewat nomor di accounting_bank_accounts).
 * Override: env SISKOPATUH_PAYMENT_ACCOUNT_NUMBER (default 1330020805941).
 */
const SISKOPATUH_PAYMENT_ACCOUNT_NUMBER =
  (process.env.SISKOPATUH_PAYMENT_ACCOUNT_NUMBER || '1330020805941').trim();

function nabielaAccountDigits() {
  return normalizeAccountNumberDigits(SISKOPATUH_PAYMENT_ACCOUNT_NUMBER);
}

function orderInvoiceBankFlags(orderLike) {
  const items = orderLike?.OrderItems || [];
  const hasSiskopatuh = items.some((it) => (it.type || it.product_type) === ORDER_ITEM_TYPE.SISKOPATUH);
  const hasNonSiskopatuh = items.some((it) => {
    const t = it.type || it.product_type;
    return t && t !== ORDER_ITEM_TYPE.SISKOPATUH;
  });
  return { hasSiskopatuh, hasNonSiskopatuh };
}

/** Jumlah subtotal IDR per item yang cocok predikat (untuk memutus rekening tujuan transfer). */
function sumOrderItemsSubtotal(orderLike, predicate) {
  const items = orderLike?.OrderItems || [];
  let sum = 0;
  for (const it of items) {
    if (!predicate(it)) continue;
    sum += parseFloat(it.subtotal) || 0;
  }
  return sum;
}

function isNabielaAccountRow(row) {
  const d = nabielaAccountDigits();
  if (!d || !row) return false;
  return normalizeAccountNumberDigits(row.account_number) === d;
}

function accRowToJson(row) {
  if (!row) return null;
  return row.get ? row.get({ plain: true }) : row.toJSON();
}

function findNabielaInSequelizeRows(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.find((a) => isNabielaAccountRow(a)) || null;
}

function findNabielaInPlainRows(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.find((a) => isNabielaAccountRow(a)) || null;
}

/**
 * Hanya siskopatuh → hanya rekening Nabiela (SISKOPATUH_PAYMENT_ACCOUNT_NUMBER).
 * Tanpa siskopatuh → rekening lain (bukan Nabiela).
 * Campuran:
 *   - Jika sisa tagihan invoice masih melebihi total subtotal item siskopatuh produk lain belum lunas
 *     → tampilkan Nabiela + rekening lain.
 *   - Jika sisa tagihan tidak lebih dari subtotal siskopatuh → hanya Nabiela.
 *
 * @param {object|undefined} invoiceMoney - { remaining_amount, paid_amount } dari invoice (IDR)
 */
function resolveBankAccountsForInvoice(orderLike, accountingInstances, rulesPlainAccounts, invoiceMoney) {
  const { hasSiskopatuh, hasNonSiskopatuh } = orderInvoiceBankFlags(orderLike || {});
  const inst = Array.isArray(accountingInstances) ? accountingInstances : [];
  const rulesArr = Array.isArray(rulesPlainAccounts) ? rulesPlainAccounts : [];

  const allJsonFromDb = inst.length > 0 ? inst.map((a) => accRowToJson(a)) : [];
  const defaultMerged = allJsonFromDb.length > 0 ? allJsonFromDb : rulesArr;

  const othersInst = inst.filter((a) => !isNabielaAccountRow(a));
  const othersJsonFromDb = othersInst.map((a) => accRowToJson(a));
  const othersRulesOnly = rulesArr.filter((a) => !isNabielaAccountRow(a));

  const nabielaInst = findNabielaInSequelizeRows(inst);
  const nabielaJsonFromDb = nabielaInst ? accRowToJson(nabielaInst) : findNabielaInPlainRows(allJsonFromDb.length ? allJsonFromDb : rulesArr);

  const money = invoiceMoney && typeof invoiceMoney === 'object' ? invoiceMoney : null;
  const remainingInv = money != null ? parseFloat(money.remaining_amount) : NaN;
  const siskSubtotal = sumOrderItemsSubtotal(orderLike, (it) => (it.type || it.product_type) === ORDER_ITEM_TYPE.SISKOPATUH);
  const MONEY_EPS = 1;

  if (hasSiskopatuh && !hasNonSiskopatuh) {
    if (nabielaJsonFromDb) return [nabielaJsonFromDb];
    return defaultMerged.length ? defaultMerged : [];
  }

  if (!hasSiskopatuh) {
    if (othersJsonFromDb.length > 0) return othersJsonFromDb;
    if (othersRulesOnly.length > 0) return othersRulesOnly;
    const filtered = defaultMerged.filter((a) => !isNabielaAccountRow(a));
    if (filtered.length > 0) return filtered;
    return defaultMerged;
  }

  let onlySiskopatuhDue = false;
  if (!Number.isNaN(remainingInv) && remainingInv >= 0 && siskSubtotal >= 0) {
    onlySiskopatuhDue = remainingInv <= siskSubtotal + MONEY_EPS;
  } else {
    const nonSiskSubtotal = sumOrderItemsSubtotal(orderLike, (it) => (it.type || it.product_type) !== ORDER_ITEM_TYPE.SISKOPATUH);
    const paid = money != null ? parseFloat(money.paid_amount) || 0 : 0;
    onlySiskopatuhDue = nonSiskSubtotal <= MONEY_EPS || paid + MONEY_EPS >= nonSiskSubtotal;
  }

  if (onlySiskopatuhDue) {
    if (nabielaJsonFromDb) return [nabielaJsonFromDb];
    return defaultMerged.length ? defaultMerged : [];
  }

  const out = [];
  if (nabielaJsonFromDb) out.push(nabielaJsonFromDb);
  const rest = othersJsonFromDb.length > 0 ? othersJsonFromDb : othersRulesOnly;
  for (const r of rest) out.push(r);
  const seen = new Set();
  return out.filter((x) => {
    const id = x && x.id ? String(x.id) : `${x?.bank_name}-${x?.account_number}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

module.exports = {
  resolveBankAccountsForInvoice,
  isNabielaAccountRow,
  SISKOPATUH_PAYMENT_ACCOUNT_NUMBER
};
