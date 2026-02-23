const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { NOTIFICATION_TRIGGER } = require('../constants');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  trigger: {
    type: DataTypes.ENUM(Object.values(NOTIFICATION_TRIGGER)),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'order_id, invoice_id, file_url, etc.'
  },
  channel_in_app: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  channel_email: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  channel_whatsapp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_sent_at: {
    type: DataTypes.DATE
  },
  whatsapp_sent_at: {
    type: DataTypes.DATE
  },
  read_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true
});

module.exports = Notification;
