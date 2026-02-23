const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  branch_id: {
    type: DataTypes.UUID,
    references: { model: 'branches', key: 'id' }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'order, invoice, price, owner_status, refund, etc.'
  },
  entity_id: {
    type: DataTypes.UUID
  },
  old_value: {
    type: DataTypes.JSONB
  },
  new_value: {
    type: DataTypes.JSONB
  },
  ip_address: {
    type: DataTypes.STRING(45)
  },
  user_agent: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

module.exports = AuditLog;
