'use strict';
/**
 * One-time fix: complete DB schema to match API (owner_profiles, owner_balance_transactions).
 * Run if ensure-database-owner-schema migration failed partway.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const config = require('../src/config/database.js');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: console.log
});

async function main() {
  const q = sequelize.getQueryInterface();

  // 1. If travel_balance_transactions exists and owner_balance_transactions exists: copy data then drop travel
  const [tbt] = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'travel_balance_transactions'"
  );
  const [obt] = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owner_balance_transactions'"
  );
  if (tbt && tbt.length > 0 && obt && obt.length > 0) {
    await sequelize.query(
      `INSERT INTO owner_balance_transactions SELECT * FROM travel_balance_transactions ON CONFLICT (id) DO NOTHING`
    );
    await q.dropTable('travel_balance_transactions');
    console.log('Dropped travel_balance_transactions after copying to owner_balance_transactions.');
  } else if (tbt && tbt.length > 0) {
    await q.renameTable('travel_balance_transactions', 'owner_balance_transactions');
    console.log('Renamed travel_balance_transactions -> owner_balance_transactions.');
  }

  // 2. If travel_profiles exists: rename to owner_profiles (or drop if owner_profiles exists)
  const [tp] = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'travel_profiles'"
  );
  const [op] = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owner_profiles'"
  );
  if (tp && tp.length > 0) {
    if (op && op.length > 0) {
      await sequelize.query('DROP TABLE IF EXISTS owner_profiles CASCADE');
      console.log('Dropped owner_profiles (so we can rename travel_profiles).');
    }
    await q.renameTable('travel_profiles', 'owner_profiles');
    console.log('Renamed travel_profiles -> owner_profiles.');
  }

  await sequelize.query(
    "INSERT INTO \"SequelizeMeta\" (name) VALUES ('20260228000001-ensure-database-owner-schema.js') ON CONFLICT DO NOTHING"
  ).catch(() => {});

  console.log('DB schema fix done. Database now matches API (owner).');
  await sequelize.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
