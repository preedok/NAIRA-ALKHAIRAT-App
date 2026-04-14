const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Wilayah = sequelize.define('Wilayah', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  province_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'wilayahs',
  underscored: true,
  timestamps: true
});

module.exports = Wilayah;
