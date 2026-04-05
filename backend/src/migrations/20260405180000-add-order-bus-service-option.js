'use strict';

/** Opsi layanan bus per order: finality (include visa), hiace, visa_only (tanpa bus). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_service_option VARCHAR(20) NOT NULL DEFAULT 'finality';`
      );
      await queryInterface.sequelize.query(
        `UPDATE orders SET bus_service_option = 'hiace' WHERE waive_bus_penalty = true;`
      );
    } else {
      await queryInterface.addColumn('orders', 'bus_service_option', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'finality'
      });
      await queryInterface.sequelize.query(
        `UPDATE orders SET bus_service_option = 'hiace' WHERE waive_bus_penalty = 1 OR waive_bus_penalty = true;`
      );
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'bus_service_option');
  }
};
