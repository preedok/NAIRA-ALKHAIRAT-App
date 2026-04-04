const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const HotelMonthlyPrice = sequelize.define('HotelMonthlyPrice', {
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
    allowNull: true,
    references: { model: 'branches', key: 'id' },
    onDelete: 'SET NULL'
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL'
  },
  year_month: {
    type: DataTypes.STRING(7),
    allowNull: false,
    comment: 'YYYY-MM'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'IDR'
  },
  room_type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  with_meal: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  /** 'room' = harga kamar per malam; 'meal' = harga makan SAR per orang per malam (room_type __meal__) */
  component: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'room'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL'
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'hotel_monthly_prices',
  underscored: true,
  timestamps: true
});

module.exports = HotelMonthlyPrice;
