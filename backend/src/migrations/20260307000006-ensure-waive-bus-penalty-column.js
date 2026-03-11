'use strict';

/** Pastikan kolom orders.waive_bus_penalty ada (jika migration 000005 gagal/ter-skip). Aman dijalankan berulang. */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE orders ADD COLUMN IF NOT EXISTS waive_bus_penalty BOOLEAN NOT NULL DEFAULT false;'
      );
    }
  },
  async down() {
    // no-op: column might have been added by 000005
  }
};
