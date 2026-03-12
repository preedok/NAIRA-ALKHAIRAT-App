'use strict';

/** Progress bus untuk order "bus include" (tanpa item bus): tiket, kedatangan, keberangkatan, kepulangan. */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_ticket_status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_ticket_info VARCHAR(500);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_arrival_status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_departure_status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_return_status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS bus_include_notes TEXT;
      `);
    }
  },
  async down() {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_ticket_status;
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_ticket_info;
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_arrival_status;
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_departure_status;
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_return_status;
        ALTER TABLE orders DROP COLUMN IF EXISTS bus_include_notes;
      `);
    }
  }
};
