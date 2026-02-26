'use strict';

/**
 * Backfill product visa: set meta.visa_kind = 'only' untuk product type=visa
 * yang belum punya visa_kind di meta (agar workflow 3 jenis visa konsisten).
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query(`
      UPDATE products
      SET meta = jsonb_set(COALESCE(meta::jsonb, '{}'), '{visa_kind}', '"only"')
      WHERE type = 'visa' AND (meta IS NULL OR meta::jsonb->>'visa_kind' IS NULL);
    `);
  },

  async down() {
    // Optional: remove visa_kind from meta (revert not strictly required)
  }
};
