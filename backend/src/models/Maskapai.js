const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Maskapai = sequelize.define('Maskapai', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'maskapai',
  underscored: true,
  timestamps: true
});

module.exports = Maskapai;
