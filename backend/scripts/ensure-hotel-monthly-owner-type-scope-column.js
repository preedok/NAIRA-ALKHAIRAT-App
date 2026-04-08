/**
 * Pastikan kolom hotel_monthly_prices.owner_type_scope + index unique terbaru ada.
 * Idempoten. Jalankan dari folder backend:
 *   npm run ensure:hotel-monthly-owner-type-scope
 */
require('dotenv').config();
const path = require('path');
const sequelize = require(path.join(__dirname, '../src/config/sequelize'));

async function columnExists() {
  const [rows] = await sequelize.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hotel_monthly_prices'
      AND column_name = 'owner_type_scope'
    LIMIT 1
  `);
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const exists = await columnExists();
  if (!exists) {
    console.log('ensure-hotel-monthly-owner-type-scope: menambah kolom owner_type_scope...');
    await sequelize.query(`
      ALTER TABLE hotel_monthly_prices
      ADD COLUMN owner_type_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    `);
  } else {
    console.log('ensure-hotel-monthly-owner-type-scope: kolom owner_type_scope sudah ada, lanjut validasi index.');
  }

  await sequelize.query(`
    UPDATE hotel_monthly_prices
    SET owner_type_scope = 'all'
    WHERE owner_type_scope IS NULL OR owner_type_scope = ''
  `);

  await sequelize.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');
  await sequelize.query(`
    CREATE UNIQUE INDEX uq_hmp_layer_month_variant
    ON hotel_monthly_prices (
      product_id,
      COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
      year_month,
      currency,
      room_type,
      with_meal,
      component,
      owner_type_scope
    )
  `);

  console.log('ensure-hotel-monthly-owner-type-scope: selesai.');
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch (_) { /* */ }
  process.exit(1);
});

