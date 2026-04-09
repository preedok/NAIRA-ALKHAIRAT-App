'use strict';

/**
 * Pastikan kolom proof_transfer_at ada di refunds (GET invoice include Refunds).
 * Idempoten. Berguna jika db:migrate tidak jalan di server.
 *
 *   npm run ensure:refunds-proof-transfer-at
 */
require('dotenv').config();
const path = require('path');
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) {
    /* ignore */
  }
}

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));

async function main() {
  if (sequelize.getDialect() !== 'postgres') {
    console.error('ensure-refunds-proof-transfer-at: hanya PostgreSQL.');
    process.exit(1);
  }
  await sequelize.authenticate();

  await sequelize.query(`
    ALTER TABLE refunds
    ADD COLUMN IF NOT EXISTS proof_transfer_at TIMESTAMP WITH TIME ZONE
  `);
  await sequelize.query(`
    COMMENT ON COLUMN refunds.proof_transfer_at IS 'Tanggal/waktu di bukti transfer (bukan waktu server)'
  `);

  console.log('ensure-refunds-proof-transfer-at: kolom proof_transfer_at pada refunds siap.');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
