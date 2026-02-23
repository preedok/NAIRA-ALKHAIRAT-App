'use strict';

/**
 * Hapus semua data transaksional dan data owner, KECUALI:
 * - Master: wilayah, provinsi, cabang (branches)
 * - Akun divisi (users dengan role != 'owner')
 * - Semua data product: products, product_prices, product_availability, hotel_seasons, hotel_room_inventory, business_rule_configs
 *
 * Urutan hapus mengikuti dependency (child dulu).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const dialect = q.getDialect();

    if (dialect !== 'postgres') {
      throw new Error('Migration ini hanya untuk PostgreSQL');
    }

    // 1. Tabel yang mengacu ke invoice / order (hapus dulu)
    await q.query('DELETE FROM payment_proofs');
    await q.query('DELETE FROM invoice_files');
    await q.query('DELETE FROM refunds');

    // 2. Accounting (journal & period)
    await q.query('DELETE FROM journal_entry_lines');
    await q.query('DELETE FROM journal_entries');
    await q.query('DELETE FROM account_mappings');
    await q.query('DELETE FROM accounting_periods');
    await q.query('DELETE FROM accounting_fiscal_years');

    // 3. Payroll transaksional
    await q.query('DELETE FROM payroll_items');
    await q.query('DELETE FROM payroll_runs');

    // 4. Progress per order item (visa, tiket, hotel, bus)
    await q.query('DELETE FROM hotel_progress');
    await q.query('DELETE FROM ticket_progress');
    await q.query('DELETE FROM visa_progress');
    await q.query('DELETE FROM bus_progress');

    // 5. Order items lalu orders
    await q.query('DELETE FROM order_items');
    await q.query('DELETE FROM invoices');
    await q.query('DELETE FROM orders');

    // 6. Log, notifikasi, preset laporan
    await q.query('DELETE FROM financial_report_presets');
    await q.query('DELETE FROM notifications');
    await q.query('DELETE FROM audit_logs');
    await q.query('DELETE FROM maintenance_notices');
    await q.query('DELETE FROM system_logs');

    // 7. Chart of accounts (master accounting - dihapus sesuai permintaan, hanya keep wilayah/provinsi/cabang + divisi + product)
    await q.query('DELETE FROM chart_of_accounts');

    // 8. Owner: nullkan referensi owner di tabel yang kita keep, hapus owner_profiles, lalu users owner
    await q.query("UPDATE product_prices SET owner_id = NULL WHERE owner_id IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE product_prices SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE product_prices SET approved_by = NULL WHERE approved_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE products SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE product_availability SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE hotel_seasons SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("UPDATE business_rule_configs SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query("DELETE FROM employee_salaries WHERE user_id IN (SELECT id FROM users WHERE role = 'owner')");
    await q.query('DELETE FROM owner_profiles');
    await q.query("DELETE FROM users WHERE role = 'owner'");

    // Selesai. Yang TETAP ADA: wilayah, provinsi, branches, users (non-owner), products, product_prices,
    // product_availability, hotel_seasons, hotel_room_inventory, business_rule_configs,
    // app_settings, payroll_settings, employee_salaries (data divisi).
  },

  async down(queryInterface, Sequelize) {
    // Tidak bisa restore data yang sudah dihapus
    return;
  }
};
