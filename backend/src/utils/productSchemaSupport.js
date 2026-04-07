'use strict';

const { QueryTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

let mouFullboardAutoCalcColumnExistsCache = null;

/**
 * True jika kolom products.mou_fullboard_auto_calc sudah ada (migration terbaca).
 * Dipakai agar API tetap jalan sebelum migration dijalankan di environment tertentu.
 */
async function hasMouFullboardAutoCalcColumn() {
  if (mouFullboardAutoCalcColumnExistsCache != null) return mouFullboardAutoCalcColumnExistsCache;
  try {
    const rows = await sequelize.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'products'
         AND column_name = 'mou_fullboard_auto_calc'
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    mouFullboardAutoCalcColumnExistsCache = Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    mouFullboardAutoCalcColumnExistsCache = false;
  }
  return mouFullboardAutoCalcColumnExistsCache;
}

/** Opsi Sequelize untuk Product: exclude kolom jika belum dimigrasi. */
async function productMouAutoAttrOption() {
  const has = await hasMouFullboardAutoCalcColumn();
  return has ? {} : { attributes: { exclude: ['mou_fullboard_auto_calc'] } };
}

const PRODUCT_CREATE_FIELDS_BASE = ['type', 'code', 'name', 'description', 'is_package', 'meta', 'created_by'];

/**
 * Untuk Product.create: jika kolom mou_fullboard_auto_calc belum dimigrasi, batasi fields agar INSERT tidak gagal.
 * @param {boolean} withMouFullboardAutoCalc hotel baru yang menyertakan flag di payload
 */
async function productCreateFieldsOption(withMouFullboardAutoCalc = false) {
  const has = await hasMouFullboardAutoCalcColumn();
  if (!has) {
    return { fields: PRODUCT_CREATE_FIELDS_BASE };
  }
  if (withMouFullboardAutoCalc) {
    return { fields: [...PRODUCT_CREATE_FIELDS_BASE, 'mou_fullboard_auto_calc'] };
  }
  return {};
}

module.exports = {
  hasMouFullboardAutoCalcColumn,
  productMouAutoAttrOption,
  productCreateFieldsOption
};
