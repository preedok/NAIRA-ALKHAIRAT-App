const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { OWNER_STATUS } = require('../constants');

const OwnerProfile = sequelize.define('OwnerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  status: {
    type: DataTypes.ENUM(Object.values(OWNER_STATUS)),
    allowNull: false,
    defaultValue: OWNER_STATUS.PENDING_REGISTRATION_PAYMENT
  },
  address: {
    type: DataTypes.TEXT
  },
  operational_region: {
    type: DataTypes.STRING(255)
  },
  whatsapp: {
    type: DataTypes.STRING(50)
  },
  npwp: {
    type: DataTypes.STRING(50)
  },
  legal_doc_url: {
    type: DataTypes.STRING(500)
  },
  mou_template_downloaded_at: {
    type: DataTypes.DATE
  },
  mou_signed_url: {
    type: DataTypes.STRING(500),
    comment: 'Upload MoU yang sudah ditandatangani'
  },
  mou_uploaded_at: {
    type: DataTypes.DATE
  },
  mou_rejected_reason: {
    type: DataTypes.TEXT
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(18, 2)
  },
  deposit_proof_url: {
    type: DataTypes.STRING(500)
  },
  deposit_verified_at: {
    type: DataTypes.DATE
  },
  deposit_verified_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  preferred_branch_id: {
    type: DataTypes.UUID,
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  assigned_branch_id: {
    type: DataTypes.UUID,
    references: { model: 'branches', key: 'id' }
  },
  assigned_at: {
    type: DataTypes.DATE
  },
  activated_at: {
    type: DataTypes.DATE
  },
  activated_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  has_special_price: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  registration_payment_proof_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  registration_payment_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    comment: 'Jumlah pembayaran MoU (IDR) yang diinput saat registrasi'
  },
  registration_payment_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  registration_payment_verified_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' },
    allowNull: true
  },
  mou_generated_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'MOU PDF yang digenerate sistem saat aktivasi'
  },
  activation_generated_password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Password yang digenerate saat aktivasi; ditampilkan di Admin Pusat; dikosongkan bila admin ubah password'
  },
  balance: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Saldo owner dari pembatalan order (jadikan saldo); dipakai untuk order baru atau alokasi ke tagihan'
  }
}, {
  tableName: 'owner_profiles',
  underscored: true,
  timestamps: true
});

module.exports = OwnerProfile;
