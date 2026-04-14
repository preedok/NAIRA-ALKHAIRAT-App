const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Kloter = sequelize.define('Kloter', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  product_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'products', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  departure_date: { type: DataTypes.DATEONLY, allowNull: false },
  return_date: { type: DataTypes.DATEONLY, allowNull: false },
  departure_airport: { type: DataTypes.STRING(120), allowNull: false },
  flight_number: { type: DataTypes.STRING(64), allowNull: true },
  capacity: { type: DataTypes.INTEGER, allowNull: false },
  filled_quota: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  group_leader_name: { type: DataTypes.STRING(255), allowNull: true },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'closed', 'completed'),
    allowNull: false,
    defaultValue: 'draft'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  }
}, {
  tableName: 'kloters',
  underscored: true,
  timestamps: true
});

module.exports = Kloter;
