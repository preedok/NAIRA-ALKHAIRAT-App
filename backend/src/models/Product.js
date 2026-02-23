const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { ORDER_ITEM_TYPE } = require('../constants');

/**
 * Master product (from admin pusat, editable by admin cabang).
 * Types: hotel, visa, ticket, bus, handling, package.
 */
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM(Object.values(ORDER_ITEM_TYPE)),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  is_package: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'true = paket (bundle), false = product single'
  },
  meta: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'room_types (hotel), meal_options, flight_routes, etc.'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'products',
  underscored: true,
  timestamps: true
});

module.exports = Product;
