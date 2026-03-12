/**
 * One-off: run ALTER TABLE to widen rekap_hotel.tentative and definite to VARCHAR(200).
 * Run from backend folder: node scripts/run-rekap-widen-migration.js
 */
require('dotenv').config();
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const sequelize = require('../src/config/sequelize');

async function run() {
  const q = sequelize.getQueryInterface();
  await q.sequelize.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "tentative" TYPE VARCHAR(200)');
  await q.sequelize.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "definite" TYPE VARCHAR(200)');
  console.log('Done. tentative and definite are now VARCHAR(200).');
  process.exit(0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
