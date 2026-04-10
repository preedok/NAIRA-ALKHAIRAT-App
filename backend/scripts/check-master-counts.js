/* eslint-disable no-console */
'use strict';

const { sequelize } = require('../src/models');

async function countTable(table) {
  try {
    const [rows] = await sequelize.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    return rows[0]?.c ?? 0;
  } catch (_) {
    return -1;
  }
}

async function run() {
  await sequelize.authenticate();
  const provinsi = await countTable('provinsi');
  const branches = await countTable('branches');
  const kotas = await countTable('kotas');
  const kabupaten = await countTable('kabupaten');
  console.log(JSON.stringify({ provinsi, branches, kotas, kabupaten }));
  await sequelize.close();
}

run().catch(async (e) => {
  console.error(e.message);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});

