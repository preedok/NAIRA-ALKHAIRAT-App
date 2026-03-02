const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PaymentProof = sequelize.define('PaymentProof', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'invoices', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  payment_type: {
    type: DataTypes.ENUM('dp', 'partial', 'full'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: 'Amount in IDR (untuk pembayaran SAR/USD dikonversi dari amount_original)'
  },
  payment_currency: {
    type: DataTypes.STRING(5),
    allowNull: true,
    defaultValue: 'IDR',
    comment: 'IDR | SAR | USD - mata uang pembayaran (Saudi)'
  },
  amount_original: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    comment: 'Jumlah dalam payment_currency (SAR/USD) saat input oleh role_invoice_saudi'
  },
  amount_idr: { type: DataTypes.DECIMAL(18, 2), allowNull: true, comment: 'Nominal transaksi dalam IDR' },
  amount_sar: { type: DataTypes.DECIMAL(18, 2), allowNull: true, comment: 'Nominal transaksi dalam SAR jika ada' },
  bank_name: {
    type: DataTypes.STRING(100)
  },
  account_number: {
    type: DataTypes.STRING(50)
  },
  transfer_date: {
    type: DataTypes.DATEONLY
  },
  proof_file_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  uploaded_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  verified_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  verified_at: {
    type: DataTypes.DATE
  },
  verified_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    comment: 'pending | verified | rejected'
  },
  notes: {
    type: DataTypes.TEXT
  },
  issued_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' },
    comment: 'Role invoice Saudi when payment done in Saudi'
  },
  payment_location: {
    type: DataTypes.ENUM('indonesia', 'saudi'),
    defaultValue: 'indonesia'
  },
  reconciled_at: {
    type: DataTypes.DATE,
    comment: 'Rekonsiliasi bank oleh accounting'
  },
  reconciled_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'payment_proofs',
  underscored: true,
  timestamps: true
});

module.exports = PaymentProof;
