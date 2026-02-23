/**
 * Metadata file PDF invoice yang disimpan di server/cloud.
 * Satu record per invoice - file terbaru meng-overwrite (atau buat versi baru).
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const InvoiceFile = sequelize.define('InvoiceFile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'invoices', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Status invoice saat file digenerate'
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Path relatif di server (uploads/invoices/xxx.pdf)'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_size: {
    type: DataTypes.INTEGER,
    comment: 'Size dalam bytes'
  },
  is_example: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True untuk file contoh per status'
  },
  generated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'invoice_files',
  underscored: true,
  timestamps: true
});

module.exports = InvoiceFile;
