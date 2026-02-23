const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(50)
  },
  role: {
    type: DataTypes.ENUM(Object.values(ROLES)),
    allowNull: false
  },
  branch_id: {
    type: DataTypes.UUID,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  wilayah_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'wilayah', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'For koordinator roles: scope to this wilayah (and its provinsi/cabang)'
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'For admin_provinsi: province/region scope'
  },
  company_name: {
    type: DataTypes.STRING(255),
    comment: 'For owner: nama perusahaan'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash && !user.password_hash.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (candidatePassword) {
  if (!this.password_hash) return false;
  return bcrypt.compare(candidatePassword, this.password_hash);
};

module.exports = User;
