const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const InvoiceStatusHistory = sequelize.define('InvoiceStatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'invoices', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  from_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  to_status: {
    type: DataTypes.STRING(50),
    allowNull: false
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
  reason: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  meta: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'invoice_status_histories',
  underscored: true,
  timestamps: true
});

module.exports = InvoiceStatusHistory;

