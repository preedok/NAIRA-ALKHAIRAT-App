const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { INVOICE_STATUS } = require('../constants');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'branches', key: 'id' }
  },
  total_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  dp_percentage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  dp_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  paid_amount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  remaining_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(Object.values(INVOICE_STATUS)),
    allowNull: false,
    defaultValue: INVOICE_STATUS.DRAFT
  },
  issued_at: {
    type: DataTypes.DATE
  },
  due_date_dp: {
    type: DataTypes.DATE,
    comment: 'Tenggat DP max 3 hari'
  },
  due_date_full: {
    type: DataTypes.DATE
  },
  auto_cancel_at: {
    type: DataTypes.DATE,
    comment: '1x24 jam setelah issued jika belum DP'
  },
  is_overdue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  overdue_activated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  overdue_activated_at: {
    type: DataTypes.DATE
  },
  terms: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Blocked when DP overdue 1x24h; role invoice can unblock'
  },
  unblocked_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  unblocked_at: { type: DataTypes.DATE },
  overpaid_amount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  overpaid_handling: {
    type: DataTypes.STRING(50),
    comment: 'refund, transfer_invoice, transfer_order'
  }
}, {
  tableName: 'invoices',
  underscored: true,
  timestamps: true
});

module.exports = Invoice;
