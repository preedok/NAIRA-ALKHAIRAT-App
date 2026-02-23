'use strict';

/**
 * Workflow: Pusat + Koordinator per wilayah.
 * - Tambah kolom wilayah_id di users (untuk koordinator).
 * - Tambah nilai enum: admin_koordinator, invoice_koordinator, tiket_koordinator, visa_koordinator, role_invoice_saudi.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const newValues = ['admin_koordinator', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator', 'role_invoice_saudi'];
    for (const val of newValues) {
      try {
        await q.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${val}'`);
      } catch (e) {
        try { await q.query(`ALTER TYPE user_role ADD VALUE '${val}'`); } catch (_) {}
      }
    }

    const [cols] = await q.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'wilayah_id';
    `);
    if (!cols || cols.length === 0) {
      await queryInterface.addColumn('users', 'wilayah_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'wilayah', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'wilayah_id').catch(() => {});
  }
};
