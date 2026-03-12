/**
 * Rekap Hotel - modul standalone untuk input/laporan orderan hotel (MADINAH, MAKKAH, HAJI, ALLOTMENT, RAMADHAN).
 * Tidak terhubung dengan Order/Invoice/Product. Hanya tabel + role role_rekap_hotel.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const RekapHotel = sequelize.define('RekapHotel', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  source_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: 'order_list | allotment | period_list'
  },
  period_name: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'HAJI 2026, AWAL RAMADAN, LAILATUL QADAR, FULL RAMADHAN, ALLOTMENT 1447'
  },
  season_year: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '1447, 2026'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // --- order_list / ledger (HOTEL MEKKAH/MADINAH spreadsheet) ---
  // TNTV, DFNT, CLIENT, HOTEL MEKKAH/MADINAH, IN, OUT, TOTAL HARI, D/T/Q/Qn/Hx, Room, Pax, Meal Plan, Status, Voucher, Keterangan, Invoice Clerk
  tentative: { type: DataTypes.STRING(200), allowNull: true, comment: 'TNTV' },
  definite: { type: DataTypes.STRING(200), allowNull: true, comment: 'DFNT' },
  client: { type: DataTypes.STRING(200), allowNull: true },
  paket: { type: DataTypes.STRING(120), allowNull: true },
  hotel_makkah: { type: DataTypes.STRING(200), allowNull: true, comment: 'HOTEL MEKKAH' },
  hotel_madinah: { type: DataTypes.STRING(200), allowNull: true, comment: 'HOTEL MADINAH' },
  check_in: { type: DataTypes.DATEONLY, allowNull: true, comment: 'IN' },
  check_out: { type: DataTypes.DATEONLY, allowNull: true, comment: 'OUT' },
  total_hari: { type: DataTypes.INTEGER, allowNull: true, comment: 'TOTAL HARI' },
  room_d: { type: DataTypes.INTEGER, allowNull: true },
  room_t: { type: DataTypes.INTEGER, allowNull: true },
  room_q: { type: DataTypes.INTEGER, allowNull: true },
  room_qn: { type: DataTypes.INTEGER, allowNull: true },
  room_hx: { type: DataTypes.INTEGER, allowNull: true },
  room: { type: DataTypes.INTEGER, allowNull: true, comment: 'Room count' },
  pax: { type: DataTypes.INTEGER, allowNull: true },
  meal_bb: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, comment: 'BB' },
  meal_fb: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, comment: 'FB' },
  status_available: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  status_booked: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  status_amend: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  status_lunas: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, comment: 'LUNAS' },
  voucher: { type: DataTypes.STRING(120), allowNull: true },
  invoice_clerk: { type: DataTypes.STRING(120), allowNull: true },
  ket: { type: DataTypes.STRING(100), allowNull: true },
  keterangan: { type: DataTypes.STRING(500), allowNull: true, comment: 'Keterangan' },
  // --- allotment (ALLOTMENT 1447 style) ---
  location: { type: DataTypes.STRING(20), allowNull: true, comment: 'mekkah | madinah' },
  hotel_name: { type: DataTypes.STRING(200), allowNull: true },
  room_7bed: { type: DataTypes.STRING(20), allowNull: true },
  room_6bed: { type: DataTypes.STRING(20), allowNull: true },
  room_quint: { type: DataTypes.STRING(20), allowNull: true },
  room_quad: { type: DataTypes.STRING(20), allowNull: true },
  room_triple: { type: DataTypes.STRING(20), allowNull: true },
  room_double: { type: DataTypes.STRING(20), allowNull: true },
  total_room: { type: DataTypes.STRING(30), allowNull: true },
  // --- period_list (RAMADHAN style) ---
  status: { type: DataTypes.STRING(32), allowNull: true, comment: 'DEFINITE | LUNAS | CANCEL | TENTATIVE' },
  ref_number: { type: DataTypes.STRING(60), allowNull: true },
  hotel_combo: { type: DataTypes.STRING(300), allowNull: true, comment: 'Hotel Makkah/Madinah combo' },
  bandara: { type: DataTypes.STRING(20), allowNull: true },
  paket_type: { type: DataTypes.STRING(60), allowNull: true, comment: 'arofah, safa, marwa, rakyat, multazam' },
  paket_label: { type: DataTypes.STRING(120), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  extra_notes: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], comment: 'Extra columns M-S for period_list' },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'rekap_hotel',
  underscored: true,
  timestamps: true
});

module.exports = RekapHotel;
