/**
 * Seed data Rekap Hotel dari sample MADINAH/HAJI/ALLOTMENT/RAMADHAN.
 * Jalankan dari folder backend: node scripts/seed-rekap-hotel.js
 */
require('dotenv').config();
const path = require('path');
process.chdir(path.join(__dirname, '..'));
const sequelize = require('../src/config/sequelize');
const { RekapHotel } = require('../src/models');

const rows = [
  // Ledger HOTEL MEKKAH style (spreadsheet)
  { source_type: 'order_list', tentative: '6675', definite: '4746', client: 'Pak Fuad', hotel_makkah: 'hilton', check_in: '2025-05-10', check_out: '2025-05-16', total_hari: 6, room: 1, pax: 23, sort_order: 0 },
  { source_type: 'order_list', tentative: '6601', definite: '4767', client: 'Alkamill', hotel_makkah: 'taiba suite', check_in: '2025-06-17', check_out: '2025-06-20', total_hari: 3, room: 1, pax: 3, meal_fb: true, status_lunas: true, keterangan: 'R', sort_order: 1 },
  { source_type: 'order_list', tentative: '5802', definite: '4876', client: 'Rute Terang', hotel_makkah: 'front taiba', check_in: '2025-05-10', check_out: '2025-05-16', total_hari: 6, room: 1, pax: 2, sort_order: 2 },
  // HAJI / existing
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '5433', client: 'ADE MEDAN', pax: 2, ket: 'dakhili', sort_order: 3 },
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '6051', client: 'ADE MEDAN', pax: 3, ket: 'dakhili', sort_order: 4 },
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '6268', client: 'ADE MEDAN', pax: 2, ket: 'dakhili', sort_order: 5 },
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '5863', client: 'ALFITRI', pax: 2, ket: 'dakhili', sort_order: 6 },
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '5312', client: 'FADA TOUR', pax: 1, ket: 'dakhili', sort_order: 7 },
  { source_type: 'order_list', period_name: 'HAJI 2026', season_year: '2026', definite: '5496', client: 'LIA BPN', pax: 33, ket: 'dakhili', sort_order: 8 },
  { source_type: 'allotment', period_name: 'ALLOTMENT 1447', season_year: '1447', location: 'mekkah', hotel_name: 'Snood', room_7bed: '3,5', total_room: '60', notes: 'bisa cek', sort_order: 9 },
  { source_type: 'allotment', period_name: 'ALLOTMENT 1447', season_year: '1447', location: 'mekkah', hotel_name: 'Nada Deafa', room_triple: '12', room_quad: '28', room_double: '8', total_room: '48', notes: 'bisa cek', sort_order: 10 },
  { source_type: 'allotment', period_name: 'ALLOTMENT 1447', season_year: '1447', location: 'mekkah', hotel_name: 'Safwa', room_7bed: '4', total_room: '50', notes: 'bisa cek', sort_order: 11 },
  { source_type: 'allotment', period_name: 'ALLOTMENT 1447', season_year: '1447', location: 'madinah', hotel_name: 'Jauharat Rasyid', total_room: '40', sort_order: 12 },
  { source_type: 'allotment', period_name: 'ALLOTMENT 1447', season_year: '1447', location: 'madinah', hotel_name: 'Royal Madinah', room_7bed: 'room', total_room: '100', notes: 'bisa cek', sort_order: 13 },
  { source_type: 'period_list', period_name: 'AWAL RAMADHAN', season_year: '2026', status: 'DEFINITE', ref_number: '5928', client: 'Shofwah', hotel_combo: 'Villa Hilton/taiba suite', bandara: 'CGK', paket_type: 'arofah', pax: 10, paket_label: 'PAKET AROFAH', sort_order: 14 },
  { source_type: 'period_list', period_name: 'AWAL RAMADHAN', season_year: '2026', status: 'DEFINITE', ref_number: '7889', client: 'Hj Lia BPN', hotel_combo: 'Villa Hilton/taiba suite', bandara: 'CGK', paket_type: 'arofah', pax: 8, sort_order: 15 },
  { source_type: 'period_list', period_name: 'LAILATUL QADAR', season_year: '2026', status: 'DEFINITE', ref_number: '7531', client: 'Karamina', hotel_combo: 'Villa Hilton', bandara: 'CGK', paket_type: 'arofah', pax: 5, paket_label: 'PAKET SAFA', sort_order: 16 },
  { source_type: 'period_list', period_name: 'FULL RAMADHAN', season_year: '2026', status: 'DEFINITE', ref_number: '6204', client: 'Anima Tour', hotel_combo: 'azka/olayan ajyad', bandara: 'CGK', paket_type: 'multazam', pax: 11, paket_label: 'PAKET MULTAZAM', sort_order: 17 },
  { source_type: 'period_list', period_name: 'FULL RAMADHAN', season_year: '2026', status: 'DEFINITE', ref_number: '6204', client: 'Anima Tour', hotel_combo: 'wahat deafah/jawharat', bandara: 'CGK', paket_type: 'safa', pax: 10, paket_label: 'PAKET RAKYAT', sort_order: 18 }
];

async function run() {
  try {
    await sequelize.authenticate();
    const count = await RekapHotel.count();
    if (count > 0) {
      console.log(`Sudah ada ${count} data rekap hotel. Lewat seed.`);
      process.exit(0);
    }
    await RekapHotel.bulkCreate(rows);
    console.log(`Seed rekap_hotel: ${rows.length} baris ditambahkan.`);
  } catch (e) {
    console.error('Seed error:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}
run();
