/* eslint-disable no-console */
'use strict';

const { sequelize } = require('../src/models');

async function run() {
  await sequelize.authenticate();
  const [rows] = await sequelize.query(
    "SELECT role, COUNT(*)::int AS total FROM users GROUP BY role ORDER BY role"
  );
  const [owners] = await sequelize.query(
    "SELECT COUNT(*)::int AS total FROM users WHERE role IN ('owner_mou','owner_non_mou','owner')"
  );
  console.log(JSON.stringify({ by_role: rows, owner_total: owners[0]?.total || 0 }));
  await sequelize.close();
}

run().catch(async (e) => {
  console.error(e.message);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});

