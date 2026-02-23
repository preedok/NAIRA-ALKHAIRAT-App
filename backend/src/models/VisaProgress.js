const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { VISA_PROGRESS_STATUS } = require('../constants');

/**
 * Progress per order item (type=visa). Role visa updates status, uploads visa document.
 * Manifest visa jamaah from OrderItem.manifest_file_url (uploaded by invoice/owner).
 */
const VisaProgress = sequelize.define('VisaProgress', {
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
    type: DataTypes.ENUM(Object.values(VISA_PROGRESS_STATUS)),
    allowNull: false,
    defaultValue: VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED
  },
  visa_file_url: {
    type: DataTypes.STRING(500),
    comment: 'Dokumen visa jamaah (upload oleh role visa)'
  },
  issued_at: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.TEXT
  },
  updated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'visa_progress',
  underscored: true,
  timestamps: true
});

module.exports = VisaProgress;
