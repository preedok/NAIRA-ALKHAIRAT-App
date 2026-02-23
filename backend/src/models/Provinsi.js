const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Provinsi = sequelize.define('Provinsi', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  kode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  wilayah_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'wilayah', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  }
}, {
  tableName: 'provinsi',
  underscored: true,
  timestamps: true
});

module.exports = Provinsi;
