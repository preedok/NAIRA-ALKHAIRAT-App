const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * Global app settings - theme, i18n, layout. Super Admin only.
 * Single row or key-value store.
 */
const AppSetting = sequelize.define('AppSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'e.g. theme, locale, primary_color, font_size, ui_template'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON string or plain value'
  },
  description: {
    type: DataTypes.STRING(255)
  }
}, {
  tableName: 'app_settings',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['key'] }]
});

module.exports = AppSetting;
