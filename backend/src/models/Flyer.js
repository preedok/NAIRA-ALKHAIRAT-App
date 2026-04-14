const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Flyer = sequelize.define('Flyer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  format: {
    type: DataTypes.ENUM('instagram', 'whatsapp', 'brosur_cetak', 'other'),
    allowNull: false
  },
  file_type: {
    type: DataTypes.ENUM('image', 'pdf'),
    allowNull: false
  },
  file_url: { type: DataTypes.TEXT, allowNull: false },
  product_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'products', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
  download_count: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  }
}, {
  tableName: 'flyers',
  underscored: true,
  timestamps: true
});

module.exports = Flyer;
