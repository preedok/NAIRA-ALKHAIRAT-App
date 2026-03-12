'use strict';

/**
 * Tambah kolom ledger HOTEL MEKKAH/MADINAH: check_in, check_out, total_hari,
 * room_d, room_t, room_q, room_qn, room_hx, room, meal_bb, meal_fb,
 * status_available, status_booked, status_amend, status_lunas, voucher, invoice_clerk, keterangan.
 * Idempotent: ADD COLUMN IF NOT EXISTS.
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const table = 'rekap_hotel';
    const add = (col, sqlType) => q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${sqlType}`);

    await add('check_in', 'DATE');
    await add('check_out', 'DATE');
    await add('total_hari', 'INTEGER');
    await add('room_d', 'INTEGER');
    await add('room_t', 'INTEGER');
    await add('room_q', 'INTEGER');
    await add('room_qn', 'INTEGER');
    await add('room_hx', 'INTEGER');
    await add('room', 'INTEGER');
    await add('meal_bb', 'BOOLEAN DEFAULT false');
    await add('meal_fb', 'BOOLEAN DEFAULT false');
    await add('status_available', 'BOOLEAN DEFAULT false');
    await add('status_booked', 'BOOLEAN DEFAULT false');
    await add('status_amend', 'BOOLEAN DEFAULT false');
    await add('status_lunas', 'BOOLEAN DEFAULT false');
    await add('voucher', 'VARCHAR(120)');
    await add('invoice_clerk', 'VARCHAR(120)');
    await add('keterangan', 'VARCHAR(500)');
  },

  async down(queryInterface) {
    const table = 'rekap_hotel';
    const cols = [
      'check_in', 'check_out', 'total_hari', 'room_d', 'room_t', 'room_q', 'room_qn', 'room_hx',
      'room', 'meal_bb', 'meal_fb', 'status_available', 'status_booked', 'status_amend', 'status_lunas',
      'voucher', 'invoice_clerk', 'keterangan'
    ];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn(table, col);
      } catch (e) {
        if (!String(e.message || '').includes('does not exist')) throw e;
      }
    }
  }
};
