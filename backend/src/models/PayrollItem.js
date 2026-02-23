const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PayrollItem = sequelize.define('PayrollItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  payroll_run_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'payroll_runs', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  base_salary: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  allowances: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  deductions: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  gross: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  total_deductions: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  net: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  slip_file_path: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  slip_generated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payroll_items',
  underscored: true,
  timestamps: true
});

module.exports = PayrollItem;
