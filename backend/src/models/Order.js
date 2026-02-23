const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  total_jamaah: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  penalty_amount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    comment: 'e.g. bus < 35 pack'
  },
  total_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'IDR'
  },
  status: {
    type: DataTypes.ENUM('draft', 'tentative', 'confirmed', 'processing', 'completed', 'cancelled', 'blocked'),
    defaultValue: 'draft'
  },
  blocked_at: { type: DataTypes.DATE },
  blocked_reason: { type: DataTypes.STRING(255) },
  unblocked_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  unblocked_at: { type: DataTypes.DATE },
  created_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'orders',
  underscored: true,
  timestamps: true
});

module.exports = Order;
