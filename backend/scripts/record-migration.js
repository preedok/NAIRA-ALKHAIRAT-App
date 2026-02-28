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
  await sequelize.query(
    "INSERT INTO \"SequelizeMeta\" (name) VALUES ('20260228000001-ensure-database-owner-schema.js') ON CONFLICT DO NOTHING"
  );
  console.log('Migration 20260228000001 recorded.');
  await sequelize.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
