const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { OWNER_STATUS } = require('../constants');

const Branch = sequelize.define('Branch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  region: {
    type: DataTypes.STRING(100)
  },
  provinsi_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'provinsi', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  manager_name: {
    type: DataTypes.STRING(255)
  },
  phone: {
    type: DataTypes.STRING(50)
  },
  email: {
    type: DataTypes.STRING(255)
  },
  address: {
    type: DataTypes.TEXT
  },
  koordinator_provinsi: {
    type: DataTypes.STRING(255)
  },
  koordinator_provinsi_phone: {
    type: DataTypes.STRING(50)
  },
  koordinator_provinsi_email: {
    type: DataTypes.STRING(255)
  },
  koordinator_wilayah: {
    type: DataTypes.STRING(255)
  },
  koordinator_wilayah_phone: {
    type: DataTypes.STRING(50)
  },
  koordinator_wilayah_email: {
    type: DataTypes.STRING(255)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'branches',
  underscored: true,
  timestamps: true
});

module.exports = Branch;
