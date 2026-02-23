'use strict';

/** Add jamaah data (ZIP or Google Drive link) for visa/ticket order items. Owner/Invoice upload; tim visa/tiket proses ke Nusuk. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (!tableInfo.jamaah_data_type) {
      await queryInterface.addColumn('order_items', 'jamaah_data_type', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'file = ZIP upload, link = Google Drive URL'
      });
    }
    if (!tableInfo.jamaah_data_value) {
      await queryInterface.addColumn('order_items', 'jamaah_data_value', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Path file (jamaah_data_type=file) atau URL (jamaah_data_type=link)'
      });
    }
    if (!tableInfo.jamaah_uploaded_at) {
      await queryInterface.addColumn('order_items', 'jamaah_uploaded_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.jamaah_uploaded_by) {
      await queryInterface.addColumn('order_items', 'jamaah_uploaded_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (tableInfo.jamaah_data_type) await queryInterface.removeColumn('order_items', 'jamaah_data_type');
    if (tableInfo.jamaah_data_value) await queryInterface.removeColumn('order_items', 'jamaah_data_value');
    if (tableInfo.jamaah_uploaded_at) await queryInterface.removeColumn('order_items', 'jamaah_uploaded_at');
    if (tableInfo.jamaah_uploaded_by) await queryInterface.removeColumn('order_items', 'jamaah_uploaded_by');
  }
};
