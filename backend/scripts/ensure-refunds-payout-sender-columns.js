'use strict';

/**
 * Pastikan kolom payout_sender_* ada di refunds (model + API GET invoice include Refunds).
 * Idempoten. Berguna jika db:migrate gagal diam-diam di deploy (2>/dev/null || true).
 *
 *   npm run ensure:refunds-payout-sender
 */
require('dotenv').config();
const path = require('path');
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) { /* ignore */ }
}

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));

async function main() {
  if (sequelize.getDialect() !== 'postgres') {
    console.error('ensure-refunds-payout-sender: hanya PostgreSQL.');
    process.exit(1);
  }
  await sequelize.authenticate();

  const stmts = [
    `ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payout_sender_bank_name VARCHAR(100)`,
    `ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payout_sender_account_number VARCHAR(50)`,
    `ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payout_sender_account_holder VARCHAR(100)`
  ];
  for (const sql of stmts) {
    await sequelize.query(sql);
  }
  console.log('ensure-refunds-payout-sender: kolom payout_sender_* pada refunds siap.');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
