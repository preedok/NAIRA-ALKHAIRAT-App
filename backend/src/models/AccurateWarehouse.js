const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccurateWarehouse = sequelize.define('AccurateWarehouse', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  branch_id: { type: DataTypes.UUID },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'accurate_warehouses', underscored: true, timestamps: true });

module.exports = AccurateWarehouse;
