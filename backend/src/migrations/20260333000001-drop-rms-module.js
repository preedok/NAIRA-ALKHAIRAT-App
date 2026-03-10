'use strict';

/**
 * Hapus modul RMS (Hotel Property Management System).
 * Drop tabel: rms_payments, rms_billing_items, rms_housekeeping_tasks, rms_reservations, rms_guests, rms_rooms, rms_room_types, rms_properties.
 * Menggunakan IF EXISTS agar aman jika tabel belum pernah dibuat.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query('DROP TABLE IF EXISTS rms_payments CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_billing_items CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_housekeeping_tasks CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_reservations CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_guests CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_rooms CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_room_types CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS rms_properties CASCADE');
  },

  async down() {
    throw new Error('down() not supported for drop-rms-module');
  }
};
