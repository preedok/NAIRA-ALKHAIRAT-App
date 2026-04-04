/**
 * Pastikan kolom hotel_monthly_prices.component + index uq_hmp_layer_month_variant ada
 * (VPS di mana db:migrate macet di migrasi lama, sehingga 20260404130000 tidak jalan).
 * Idempoten. Jalankan dari folder backend: npm run ensure:hotel-monthly-component
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
      AND column_name = 'component'
    LIMIT 1
  `);
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  if (await columnExists()) {
    console.log('ensure-hotel-monthly-component: kolom component sudah ada, lewati.');
    await sequelize.close();
    return;
  }

  console.log('ensure-hotel-monthly-component: menambah kolom component + unique index...');
  await sequelize.query(`
    ALTER TABLE hotel_monthly_prices
    ADD COLUMN component VARCHAR(16) NOT NULL DEFAULT 'room'
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
      component
    )
  `);
  console.log('ensure-hotel-monthly-component: selesai.');
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch (_) { /* */ }
  process.exit(1);
});
