const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * Maintenance / bug notices - Super Admin creates; shown to all users.
 */
const MaintenanceNotice = sequelize.define('MaintenanceNotice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('maintenance', 'bug', 'info', 'warning'),
    allowNull: false,
    defaultValue: 'maintenance'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  starts_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ends_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  block_app: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'When true and notice is active, all roles except super_admin see full maintenance page'
  },
  created_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'maintenance_notices',
  underscored: true,
  timestamps: true
});

module.exports = MaintenanceNotice;
