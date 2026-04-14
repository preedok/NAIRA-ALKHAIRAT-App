/**
 * Menjalankan migrasi DDL (jika perlu) + seed master provinsi & wilayah.
 * Idempotent: seed dilewati jika provinsi sudah ada.
 *
 * Usage: node scripts/seedMasterGeo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const geoRows = require('../src/data/indonesiaGeoSeed');
const { sequelize, Province, Wilayah } = require('../src/models');

async function applySqlFile(relPath) {
  const sqlPath = path.join(__dirname, '..', relPath);
  let sql = fs.readFileSync(sqlPath, 'utf8');
  sql = sql.replace(/--[^\n]*/g, '').trim();
  const parts = sql.split(';').map((s) => s.trim()).filter(Boolean);
  for (const statement of parts) {
    // eslint-disable-next-line no-await-in-loop
    await sequelize.query(statement);
  }
}

async function run() {
  await sequelize.authenticate();
  await applySqlFile('sql/20260415_provinces_wilayahs.sql');
  const existing = await Province.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log('Master geo sudah berisi (%d provinsi). Lewati seed.', existing);
    process.exit(0);
    return;
  }
  for (const row of geoRows) {
    // eslint-disable-next-line no-await-in-loop
    const prov = await Province.create({ name: row.province });
    for (const w of row.wilayahs) {
      // eslint-disable-next-line no-await-in-loop
      await Wilayah.create({ province_id: prov.id, name: w });
    }
  }
  // eslint-disable-next-line no-console
  console.log('Seed selesai: %d provinsi.', geoRows.length);
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
