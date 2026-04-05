const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { REFUND_STATUS, REFUND_SOURCE } = require('../constants');

const Refund = sequelize.define('Refund', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'invoices', key: 'id' }
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'orders', key: 'id' }
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  bank_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama bank untuk transfer refund (diisi owner)'
  },
  account_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor rekening untuk refund (diisi owner)'
  },
  account_holder_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama pemilik rekening (untuk proses refund oleh accounting)'
  },
  source: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: REFUND_SOURCE.CANCEL,
    comment: 'cancel = refund saat batalkan order; balance = tarik saldo'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(Object.values(REFUND_STATUS)),
    allowNull: false,
    defaultValue: REFUND_STATUS.REQUESTED
  },
  reason: {
    type: DataTypes.TEXT
  },
  requested_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  approved_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  approved_at: {
    type: DataTypes.DATE
  },
  rejection_reason: {
    type: DataTypes.TEXT
  },
  refunded_at: {
    type: DataTypes.DATE
  },
  proof_file_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Bukti transfer refund (upload oleh accounting); dikirim ke email pemesan setelah proses selesai'
  },
  payout_sender_bank_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Bank pengirim (rekening BGG saat transfer ke owner)'
  },
  payout_sender_account_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor rekening pengirim (opsional)'
  },
  payout_sender_account_holder: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama pemilik rekening pengirim'
  }
}, {
  tableName: 'refunds',
  underscored: true,
  timestamps: true
});

module.exports = Refund;
