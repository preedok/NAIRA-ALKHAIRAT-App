const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { PAYROLL_METHOD } = require('../constants');

const PayrollSetting = sequelize.define('PayrollSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: PAYROLL_METHOD.MANUAL
  },
  payroll_day_of_month: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  run_time: {
    type: DataTypes.STRING(5),
    allowNull: true,
    comment: 'HH:mm'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  company_name_slip: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  company_address_slip: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payroll_settings',
  underscored: true,
  timestamps: true
});

module.exports = PayrollSetting;
