const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const TicketSeasonQuota = sequelize.define('TicketSeasonQuota', {
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
    references: { model: 'ticket_seasons', key: 'id' },
    onDelete: 'CASCADE'
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'ticket_season_quota',
  underscored: true,
  timestamps: true
});

module.exports = TicketSeasonQuota;
