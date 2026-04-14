const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const KloterAssignment = sequelize.define('KloterAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  kloter_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'kloters', key: 'id' },
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
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  departure_status: {
    type: DataTypes.ENUM('terdaftar', 'dokumen_lengkap', 'proses_visa', 'visa_disetujui', 'sudah_berangkat', 'selesai'),
    allowNull: false,
    defaultValue: 'terdaftar'
  },
  assigned_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  }
}, {
  tableName: 'kloter_assignments',
  underscored: true,
  timestamps: true
});

module.exports = KloterAssignment;
