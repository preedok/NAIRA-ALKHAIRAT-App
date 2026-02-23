'use strict';

/**
 * Buat tabel system_logs jika belum ada (untuk log backend/frontend yang tampil di aplikasi Super Admin).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'system_logs';
    `);
    if (tables && tables.length > 0) return;

    await queryInterface.createTable('system_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      source: {
        type: Sequelize.ENUM('backend', 'frontend', 'database'),
        allowNull: false
      },
      level: {
        type: Sequelize.ENUM('info', 'warn', 'error', 'debug'),
        allowNull: false,
        defaultValue: 'info'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      meta: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('system_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_system_logs_source";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_system_logs_level";');
  }
};
