const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { ORDER_ITEM_TYPE } = require('../constants');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  type: {
    type: DataTypes.ENUM(Object.values(ORDER_ITEM_TYPE)),
    allowNull: false
  },
  product_ref_id: {
    type: DataTypes.UUID,
    comment: 'ID referensi ke product (hotel_id, visa_id, dll)'
  },
  product_ref_type: {
    type: DataTypes.STRING(50)
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  unit_price: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: 'Harga satuan dalam IDR.'
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: 'Total baris item; export daftar invoice: kolom Subtotal.'
  },
  manifest_file_url: {
    type: DataTypes.STRING(500),
    comment: 'Wajib untuk visa/tiket (legacy / file hasil tim)'
  },
  jamaah_data_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'file = ZIP data jamaah, link = Google Drive URL'
  },
  jamaah_data_value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Path file ZIP atau URL Google Drive'
  },
  jamaah_uploaded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  jamaah_uploaded_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  meta: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'room_type, check_in, check_out, flight_number, dll'
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'order_items',
  underscored: true,
  timestamps: true
});

module.exports = OrderItem;
