const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Province = sequelize.define('Province', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'provinces',
  underscored: true,
  timestamps: true
});

module.exports = Province;
