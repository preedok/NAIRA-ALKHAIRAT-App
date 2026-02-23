const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * System logs - backend, frontend, database. For Super Admin monitoring.
 */
const SystemLog = sequelize.define('SystemLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  source: {
    type: DataTypes.ENUM('backend', 'frontend', 'database'),
    allowNull: false
  },
  level: {
    type: DataTypes.ENUM('info', 'warn', 'error', 'debug'),
    allowNull: false,
    defaultValue: 'info'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  meta: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'path, method, userId, stack, query, etc.'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'system_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

module.exports = SystemLog;
