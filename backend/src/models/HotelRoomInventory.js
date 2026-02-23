const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const HotelRoomInventory = sequelize.define('HotelRoomInventory', {
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
    references: { model: 'hotel_seasons', key: 'id' },
    onDelete: 'CASCADE'
  },
  room_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  total_rooms: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'hotel_room_inventory',
  underscored: true,
  timestamps: true
});

module.exports = HotelRoomInventory;
