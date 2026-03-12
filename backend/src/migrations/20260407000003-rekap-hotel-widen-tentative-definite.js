'use strict';

/**
 * Perlebar kolom tentative dan definite agar nilai panjang dari HTML ledger tidak error.
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "tentative" TYPE VARCHAR(200)');
    await q.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "definite" TYPE VARCHAR(200)');
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "tentative" TYPE VARCHAR(60)');
    await q.query('ALTER TABLE "rekap_hotel" ALTER COLUMN "definite" TYPE VARCHAR(60)');
  }
};
