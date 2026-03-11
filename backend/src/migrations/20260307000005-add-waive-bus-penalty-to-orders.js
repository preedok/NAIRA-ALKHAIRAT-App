'use strict';

/** Order: waive_bus_penalty = pakai Hiace (1x) instead of bus penalty; item Hiace qty 1 ditambah otomatis dan tampil di progress bus. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE orders ADD COLUMN IF NOT EXISTS waive_bus_penalty BOOLEAN NOT NULL DEFAULT false;'
      );
    } else {
      await queryInterface.addColumn('orders', 'waive_bus_penalty', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'waive_bus_penalty');
  }
};
