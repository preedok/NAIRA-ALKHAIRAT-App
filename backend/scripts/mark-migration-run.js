'use strict';
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
  logging: false
});

async function main() {
  const [r] = await sequelize.query('SELECT name FROM "SequelizeMeta" WHERE name = \'20260226000030-rename-owner-to-travel.js\'');
  if (!r || r.length === 0) {
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (\'20260226000030-rename-owner-to-travel.js\')');
    console.log('Marked 20260226000030 as already run (skip owner->travel rename).');
  } else {
    console.log('Migration already marked.');
  }
  await sequelize.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
