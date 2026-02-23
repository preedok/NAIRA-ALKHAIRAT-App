'use strict';

/** Tabel preset filter laporan keuangan - simpan filter favorit per user */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('financial_report_presets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      filters: {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: 'period, year, month, date_from, date_to, branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, product_type, search, min_amount, max_amount'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('financial_report_presets', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('financial_report_presets');
  }
};
