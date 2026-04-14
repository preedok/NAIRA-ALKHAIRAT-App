const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { BUSINESS_RULE_KEYS } = require('../constants');

/**
 * Business rules: global (kota_id null) atau per kota (kolom DB: kota_id, atribut Sequelize: branch_id).
 * Keys: require_hotel_with_visa, dp_grace_hours, dp_due_days (legacy, tidak memakai untuk jatuh tempo invoice).
 */
const BusinessRuleConfig = sequelize.define('BusinessRuleConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON or string'
  },
  branch_id: {
    type: DataTypes.UUID,
    field: 'kota_id',
    references: { model: 'kotas', key: 'id' },
    comment: 'null = global (pusat) or per-wilayah'
  },
  wilayah_id: {
    type: DataTypes.UUID,
    references: { model: 'wilayah', key: 'id' },
    allowNull: true,
    comment: 'when branch_id null: null = global, set = rules for that wilayah'
  },
  updated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'business_rule_configs',
  underscored: true,
  timestamps: true,
  updatedAt: 'updated_at'
});

module.exports = BusinessRuleConfig;
