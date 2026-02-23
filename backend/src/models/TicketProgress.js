const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { TICKET_PROGRESS_STATUS } = require('../constants');

/**
 * Progress per order item (type=ticket). Role ticket updates status, uploads ticket document.
 * Manifest jamaah from OrderItem.manifest_file_url (uploaded by invoice/owner).
 */
const TicketProgress = sequelize.define('TicketProgress', {
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
    type: DataTypes.ENUM(Object.values(TICKET_PROGRESS_STATUS)),
    allowNull: false,
    defaultValue: TICKET_PROGRESS_STATUS.PENDING
  },
  ticket_file_url: {
    type: DataTypes.STRING(500),
    comment: 'Dokumen tiket jamaah (upload oleh role ticket)'
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
  tableName: 'ticket_progress',
  underscored: true,
  timestamps: true
});

module.exports = TicketProgress;
