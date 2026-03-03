const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Kabupaten = sequelize.define('Kabupaten', {
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
  nama: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  provinsi_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'provinsi', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'kabupaten',
  underscored: true,
  timestamps: true
});

module.exports = Kabupaten;
