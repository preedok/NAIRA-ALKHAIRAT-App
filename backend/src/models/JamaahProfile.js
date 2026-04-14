const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const JamaahProfile = sequelize.define('JamaahProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  passport_name: { type: DataTypes.STRING(255), allowNull: false },
  father_name: { type: DataTypes.STRING(255), allowNull: false },
  birth_place: { type: DataTypes.STRING(120), allowNull: false },
  birth_date: { type: DataTypes.DATEONLY, allowNull: false },
  gender: { type: DataTypes.ENUM('male', 'female'), allowNull: false },
  marital_status: { type: DataTypes.ENUM('single', 'married', 'widowed', 'divorced'), allowNull: false },
  nik: { type: DataTypes.STRING(32), allowNull: false },
  phone: { type: DataTypes.STRING(50), allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: false },
  passport_number: { type: DataTypes.STRING(64), allowNull: false },
  passport_issued_date: { type: DataTypes.DATEONLY, allowNull: false },
  passport_expiry_date: { type: DataTypes.DATEONLY, allowNull: false },
  blood_type: { type: DataTypes.STRING(4), allowNull: true },
  congenital_disease_history: { type: DataTypes.TEXT, allowNull: true },
  emergency_contact_name: { type: DataTypes.STRING(255), allowNull: false },
  emergency_contact_relationship: { type: DataTypes.STRING(120), allowNull: false },
  emergency_contact_phone: { type: DataTypes.STRING(50), allowNull: false },
  profile_status: {
    type: DataTypes.ENUM('draft', 'submitted', 'under_review', 'rejected', 'verified'),
    defaultValue: 'draft',
    allowNull: false
  },
  submitted_at: { type: DataTypes.DATE, allowNull: true },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  reviewed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'jamaah_profiles',
  underscored: true,
  timestamps: true
});

module.exports = JamaahProfile;
