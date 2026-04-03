'use strict';

/**
 * Pastikan kolom owner manual ada di orders & invoices (some DB belum menjalankan 20260326000031).
 * Idempoten: aman dipanggil berulang.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ensureInvoiceOrderOwnerColumns = async (table) => {
      let d;
      try {
        d = await queryInterface.describeTable(table);
      } catch {
        return;
      }
      if (!d.owner_name_manual) {
        await queryInterface.addColumn(table, 'owner_name_manual', {
          type: Sequelize.STRING(255),
          allowNull: true
        });
      }
      if (!d.owner_phone_manual) {
        await queryInterface.addColumn(table, 'owner_phone_manual', {
          type: Sequelize.STRING(50),
          allowNull: true
        });
      }
      if (!d.owner_input_mode) {
        await queryInterface.addColumn(table, 'owner_input_mode', {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'registered'
        });
      }
    };

    await ensureInvoiceOrderOwnerColumns('orders');
    await ensureInvoiceOrderOwnerColumns('invoices');

    // Isi invoice dari order jika masih kosong (mirror logika 20260326000031)
    await queryInterface.sequelize.query(`
      UPDATE invoices i
      SET owner_name_manual = o.owner_name_manual,
          owner_phone_manual = o.owner_phone_manual,
          owner_input_mode = COALESCE(i.owner_input_mode, o.owner_input_mode, 'registered')
      FROM orders o
      WHERE i.order_id = o.id
        AND (
          (i.owner_name_manual IS NULL AND o.owner_name_manual IS NOT NULL)
          OR (i.owner_phone_manual IS NULL AND o.owner_phone_manual IS NOT NULL)
        )
    `);
  },

  async down() {
    // No-op: tidak menghapus kolom (bisa dipakai data production).
  }
};
