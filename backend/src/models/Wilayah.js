const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Wilayah = sequelize.define('Wilayah', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'wilayah',
  underscored: true,
  timestamps: true
});

module.exports = Wilayah;
