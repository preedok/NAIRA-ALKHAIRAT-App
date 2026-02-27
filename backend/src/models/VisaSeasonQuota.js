const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const VisaSeasonQuota = sequelize.define('VisaSeasonQuota', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' },
    onDelete: 'CASCADE'
  },
  season_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'visa_seasons', key: 'id' },
    onDelete: 'CASCADE'
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'visa_season_quota',
  underscored: true,
  timestamps: true
});

module.exports = VisaSeasonQuota;
