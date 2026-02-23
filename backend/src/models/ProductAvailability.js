const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * Ketersediaan umum (acuan) per product. Admin pusat set nilai awal; role hotel/tiket/visa update real-time.
 */
const ProductAvailability = sequelize.define('ProductAvailability', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'products', key: 'id' },
    onDelete: 'CASCADE'
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Jumlah umum (kamar, seat, kuota visa)'
  },
  meta: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Breakdown: room_types: { single: 10, double: 5 }, meal_available, routes, dll'
  },
  updated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'product_availability',
  underscored: true,
  timestamps: true
});

module.exports = ProductAvailability;
