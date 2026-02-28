const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccurateDepreciationSchedule = sequelize.define('AccurateDepreciationSchedule', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fixed_asset_id: { type: DataTypes.UUID, allowNull: false },
  period_id: { type: DataTypes.UUID },
  period_label: { type: DataTypes.STRING(20) },
  depreciation_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  accumulated_depreciation: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  journal_entry_id: { type: DataTypes.UUID },
  posted_at: { type: DataTypes.DATE }
}, { tableName: 'accurate_depreciation_schedule', underscored: true, timestamps: true });

module.exports = AccurateDepreciationSchedule;
