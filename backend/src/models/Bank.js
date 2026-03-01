const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Bank = sequelize.define('Bank', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(20), allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'banks', underscored: true, timestamps: true });

module.exports = Bank;
