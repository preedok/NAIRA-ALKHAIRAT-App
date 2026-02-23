'use strict';

/**
 * Drop non-core feature tables: flyer_templates, ui_templates.
 * Flyer (marketing template) and UI template switching are outside core business workflow.
 * Pakai DROP TABLE IF EXISTS agar aman saat tabel belum ada (setelah fresh migrate).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS flyer_templates;');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS ui_templates;');
  },

  async down(queryInterface, Sequelize) {
    // Rollback: recreate tables (hanya jika perlu revert)
    await queryInterface.createTable('flyer_templates', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      product_id: { type: Sequelize.UUID, allowNull: true },
      design_content: { type: Sequelize.TEXT, allowNull: true },
      thumbnail_url: { type: Sequelize.STRING, allowNull: true },
      is_published: { type: Sequelize.BOOLEAN, defaultValue: false },
      published_at: { type: Sequelize.DATE, allowNull: true },
      created_by: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('ui_templates', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      code: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      config: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
  }
};
