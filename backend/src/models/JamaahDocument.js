const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const JamaahDocument = sequelize.define('JamaahDocument', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  jamaah_profile_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'jamaah_profiles', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  doc_type: {
    type: DataTypes.ENUM(
      'passport_data_page',
      'ktp',
      'kartu_keluarga',
      'photo_4x6_white',
      'photo_3x4_white',
      'vaccine_meningitis',
      'akta_nikah',
      'surat_keterangan_mahram'
    ),
    allowNull: false
  },
  file_url: { type: DataTypes.TEXT, allowNull: false },
  verification_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true },
  verified_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  verified_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'jamaah_documents',
  underscored: true,
  timestamps: true
});

module.exports = JamaahDocument;
