const sequelize = require('../src/config/sequelize');
const { DataTypes } = require('sequelize');

async function main() {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();
  const cols = await qi.describeTable('products');
  if (!cols.mou_fullboard_auto_calc) {
    await qi.addColumn('products', 'mou_fullboard_auto_calc', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('Added products.mou_fullboard_auto_calc');
  } else {
    console.log('products.mou_fullboard_auto_calc already exists');
  }
  await sequelize.close();
}

main().catch(async (e) => {
  console.error('ensure-product-mou-fullboard-column failed:', e.message || String(e));
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});

