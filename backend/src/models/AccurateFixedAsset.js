const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccurateFixedAsset = sequelize.define('AccurateFixedAsset', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  asset_code: { type: DataTypes.STRING(50), allowNull: false },
  asset_name: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(50) },
  purchase_date: { type: DataTypes.DATEONLY },
  acquisition_cost: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  residual_value: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  useful_life_years: { type: DataTypes.INTEGER, defaultValue: 1 },
  depreciation_method: { type: DataTypes.STRING(30), defaultValue: 'straight_line' },
  asset_account_id: { type: DataTypes.UUID },
  accumulated_depreciation_account_id: { type: DataTypes.UUID },
  expense_account_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  status: { type: DataTypes.STRING(30), defaultValue: 'active' }
}, { tableName: 'accurate_fixed_assets', underscored: true, timestamps: true });

module.exports = AccurateFixedAsset;
