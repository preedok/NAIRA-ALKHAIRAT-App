'use strict';

/**
 * Isi meta.location untuk product hotel yang belum punya:
 * - nama mengandung Madinah -> 'madinah'
 * - nama mengandung Mekkah/Makkah -> 'makkah'
 * Agar filter tab Hotel Mekkah / Hotel Madinah di Progress Hotel bisa menampilkan data.
 */
module.exports = {
  async up(queryInterface) {
    // Madinah: isi meta.location = 'madinah' untuk product hotel yang namanya mengandung Madinah
    await queryInterface.sequelize.query(
      `UPDATE products
       SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{location}', '"madinah"')
       WHERE type = 'hotel'
         AND (meta IS NULL OR meta->>'location' IS NULL OR meta->>'location' = '')
         AND name ILIKE '%madinah%'`
    );
    // Mekkah / Makkah: isi meta.location = 'makkah' untuk product hotel yang namanya mengandung Mekkah/Makkah
    await queryInterface.sequelize.query(
      `UPDATE products
       SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{location}', '"makkah"')
       WHERE type = 'hotel'
         AND (meta IS NULL OR meta->>'location' IS NULL OR meta->>'location' = '')
         AND (name ILIKE '%mekkah%' OR name ILIKE '%makkah%')`
    );
  },

  async down() {
    // Tidak di-rollback: meta.location tetap ada
  }
};
