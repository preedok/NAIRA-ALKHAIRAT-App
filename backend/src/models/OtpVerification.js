const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const OtpVerification = sequelize.define('OtpVerification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  otp_code: {
    type: DataTypes.STRING(6),
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('whatsapp', 'email'),
    allowNull: false,
    defaultValue: 'whatsapp'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  resend_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'otp_verifications',
  underscored: true,
  timestamps: true
});

module.exports = OtpVerification;
