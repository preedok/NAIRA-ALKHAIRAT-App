const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  owner_name_manual: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  owner_phone_manual: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  owner_input_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'registered'
  },
  pic_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nama PIC order/invoice (disalin ke invoice saat diterbitkan)'
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: false,
    // Kompatibilitas DB produksi: banyak environment masih menyimpan FK di kolom branch_id.
    field: 'branch_id',
    references: { model: 'branches', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  total_jamaah: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0
  },
  penalty_amount: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0,
    comment: 'e.g. bus < 35 pack'
  },
  total_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('draft', 'tentative', 'confirmed', 'processing', 'completed', 'cancelled', 'blocked'),
    defaultValue: 'draft'
  },
  blocked_at: { type: DataTypes.DATE },
  blocked_reason: { type: DataTypes.STRING(255) },
  unblocked_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  unblocked_at: { type: DataTypes.DATE },
  created_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  notes: {
    type: DataTypes.TEXT
  },
  invoice_keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Keterangan invoice (textarea form); disalin ke invoices.notes saat diterbitkan / update'
  },
  dp_payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'tagihan_dp = belum bayar DP, pembayaran_dp = sudah ada bukti bayar DP'
  },
  dp_percentage_paid: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Persen pembayaran DP dari total tagihan terbaru (0-100)'
  },
  total_amount_idr: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  order_updated_at: { type: DataTypes.DATE, allowNull: true },
  waive_bus_penalty: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Jika true: tanpa penalti bus, 1 Hiace ditambah otomatis, tampil di progress bus'
  },
  bus_service_option: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'finality',
    comment: 'finality=bus include visa; hiace=Hiace; visa_only=tanpa bus'
  },
  bus_include_ticket_status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'pending' },
  bus_include_ticket_info: { type: DataTypes.STRING(500), allowNull: true },
  bus_include_arrival_status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'pending', comment: 'pending | di_proses | terbit' },
  bus_include_arrival_bus_number: { type: DataTypes.STRING(100), allowNull: true },
  bus_include_arrival_date: { type: DataTypes.DATEONLY, allowNull: true },
  bus_include_arrival_time: { type: DataTypes.STRING(20), allowNull: true },
  bus_include_arrival_ticket_file_url: { type: DataTypes.STRING(500), allowNull: true },
  bus_include_departure_status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'pending' },
  bus_include_return_status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'pending', comment: 'pending | di_proses | terbit' },
  bus_include_return_bus_number: { type: DataTypes.STRING(100), allowNull: true },
  bus_include_return_date: { type: DataTypes.DATEONLY, allowNull: true },
  bus_include_return_time: { type: DataTypes.STRING(20), allowNull: true },
  bus_include_return_ticket_file_url: { type: DataTypes.STRING(500), allowNull: true },
  bus_include_notes: { type: DataTypes.TEXT, allowNull: true },
  bus_include_ticket_file_url: { type: DataTypes.STRING(500), allowNull: true }
}, {
  tableName: 'orders',
  underscored: true,
  timestamps: true
});

module.exports = Order;
