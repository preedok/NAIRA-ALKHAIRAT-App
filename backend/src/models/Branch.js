const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Branch = sequelize.define('Branch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  province_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  wilayah_id: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'branches',
  underscored: true,
  timestamps: true
});

module.exports = Branch;
