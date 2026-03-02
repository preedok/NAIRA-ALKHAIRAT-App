const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const OrderRevision = sequelize.define('OrderRevision', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'invoices', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  revision_no: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  changed_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  changed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  diff: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  totals_before: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  totals_after: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'order_revisions',
  underscored: true,
  timestamps: true
});

module.exports = OrderRevision;

