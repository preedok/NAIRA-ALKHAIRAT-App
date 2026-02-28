const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * Price layers: general (pusat, branch_id null), branch override (branch_id set), special owner (owner_id set).
 * Role invoice can set special for owner; admin cabang can set branch override.
 */
const ProductPrice = sequelize.define('ProductPrice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' },
    onDelete: 'CASCADE'
  },
  branch_id: {
    type: DataTypes.UUID,
    references: { model: 'branches', key: 'id' },
    comment: 'null = pusat general'
  },
  owner_id: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' },
    comment: 'null = general/branch price; set = special for owner'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'IDR'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  meta: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'room_type, meal_plan, etc. for variant price'
  },
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  effective_until: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  created_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  approved_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'product_prices',
  underscored: true,
  timestamps: true
});

module.exports = ProductPrice;
