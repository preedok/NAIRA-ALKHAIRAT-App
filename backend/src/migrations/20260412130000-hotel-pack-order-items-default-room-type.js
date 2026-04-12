'use strict';

/**
 * Item hotel per-pack dengan meta.room_type kosong → isi default 'quad'
 * agar laporan/PDF dan permintaan tipe kamar konsisten setelah UI memakai tipe eksplisit.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE order_items oi
      SET meta = jsonb_set(COALESCE(oi.meta, '{}'::jsonb), '{room_type}', '"quad"', true),
          updated_at = NOW()
      FROM products p
      WHERE oi.type = 'hotel'
        AND oi.product_ref_id IS NOT NULL
        AND oi.product_ref_id = p.id
        AND p.type = 'hotel'
        AND LOWER(COALESCE(p.meta->>'room_pricing_mode', '')) IN ('per_pack', 'per_person')
        AND (
          oi.meta->>'room_type' IS NULL
          OR TRIM(COALESCE(oi.meta->>'room_type', '')) = ''
        );
    `);
  },

  async down() {
    // Data backfill; tidak dikembalikan.
  }
};
