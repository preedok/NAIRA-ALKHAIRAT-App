const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { BUS_TICKET_STATUS, BUS_TRIP_STATUS } = require('../constants');

/**
 * Progress per order item (type=bus). Role bus Saudi: tiket bis, status kedatangan/keberangkatan/kepulangan.
 */
const BusProgress = sequelize.define('BusProgress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_item_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'order_items', key: 'id' },
    onDelete: 'CASCADE'
  },
  bus_ticket_status: {
    type: DataTypes.ENUM(Object.values(BUS_TICKET_STATUS)),
    allowNull: false,
    defaultValue: BUS_TICKET_STATUS.PENDING
  },
  bus_ticket_info: {
    type: DataTypes.STRING(500),
    comment: 'Info tiket bis (nomor, dll)'
  },
  arrival_status: {
    type: DataTypes.ENUM(Object.values(BUS_TRIP_STATUS)),
    allowNull: false,
    defaultValue: BUS_TRIP_STATUS.PENDING
  },
  departure_status: {
    type: DataTypes.ENUM(Object.values(BUS_TRIP_STATUS)),
    allowNull: false,
    defaultValue: BUS_TRIP_STATUS.PENDING
  },
  return_status: {
    type: DataTypes.ENUM(Object.values(BUS_TRIP_STATUS)),
    allowNull: false,
    defaultValue: BUS_TRIP_STATUS.PENDING
  },
  notes: {
    type: DataTypes.TEXT
  },
  updated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'bus_progress',
  underscored: true,
  timestamps: true
});

module.exports = BusProgress;
