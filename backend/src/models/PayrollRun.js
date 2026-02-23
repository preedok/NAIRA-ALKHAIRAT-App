const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { PAYROLL_METHOD, PAYROLL_RUN_STATUS } = require('../constants');

const PayrollRun = sequelize.define('PayrollRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  period_month: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  period_year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: PAYROLL_RUN_STATUS.DRAFT
  },
  method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: PAYROLL_METHOD.MANUAL
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  total_amount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  finalized_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'payroll_runs',
  underscored: true,
  timestamps: true
});

module.exports = PayrollRun;
