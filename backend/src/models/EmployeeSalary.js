const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const EmployeeSalary = sequelize.define('EmployeeSalary', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  effective_to: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'employee_salaries',
  underscored: true,
  timestamps: true
});

module.exports = EmployeeSalary;
