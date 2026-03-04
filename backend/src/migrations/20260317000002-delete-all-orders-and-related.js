'use strict';

/**
 * Hapus semua order dan data yang mengacu ke order/order_items.
 * Agar dashboard admin-pusat dan reports konsisten: setelah invoice dihapus, order juga kosong.
 * Urutan: unlink refunds.order_id, hapus order_revisions, progress (hotel/visa/ticket/bus), order_items, orders.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const dialect = q.getDialect();

    if (dialect !== 'postgres') {
      throw new Error('Migration ini hanya untuk PostgreSQL');
    }

    await q.query('UPDATE refunds SET order_id = NULL WHERE order_id IS NOT NULL');
    await q.query('DELETE FROM order_revisions');
    await q.query('DELETE FROM hotel_progress');
    await q.query('DELETE FROM visa_progress');
    await q.query('DELETE FROM ticket_progress');
    await q.query('DELETE FROM bus_progress');
    await q.query('DELETE FROM order_items');
    await q.query('DELETE FROM orders');
  },

  async down(queryInterface, Sequelize) {
    return;
  }
};
