const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { HOTEL_PROGRESS_STATUS } = require('../constants');

/**
 * Progress per order item (type=hotel). Role hotel updates status, room number, meal status.
 */
const HotelProgress = sequelize.define('HotelProgress', {
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
  status: {
    type: DataTypes.ENUM(Object.values(HOTEL_PROGRESS_STATUS)),
    allowNull: false,
    defaultValue: HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION
  },
  room_number: {
    type: DataTypes.STRING(50),
    comment: 'Nomor kamar saat status room_assigned/completed'
  },
  meal_status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed'),
    defaultValue: 'pending'
    // comment removed: Sequelize generates invalid SQL (COMMENT + USING) for enum alter on PostgreSQL
  },
  check_in_date: { type: DataTypes.DATEONLY },
  check_out_date: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  updated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'hotel_progress',
  underscored: true,
  timestamps: true
});

module.exports = HotelProgress;
