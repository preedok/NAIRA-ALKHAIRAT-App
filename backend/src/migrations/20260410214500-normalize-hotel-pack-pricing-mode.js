'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{room_pricing_mode}', '"per_pack"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'room_pricing_mode', '') = 'per_person';
    `);

    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{pricing_mode}', '"per_pack"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'pricing_mode', '') = 'per_person';
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{room_pricing_mode}', '"per_pack"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'room_pricing_mode', '') = 'per_person';
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{pricing_mode}', '"per_pack"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'pricing_mode', '') = 'per_person';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{room_pricing_mode}', '"per_person"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'room_pricing_mode', '') = 'per_pack';
    `);

    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{pricing_mode}', '"per_person"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'pricing_mode', '') = 'per_pack';
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{room_pricing_mode}', '"per_person"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'room_pricing_mode', '') = 'per_pack';
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{pricing_mode}', '"per_person"', true),
          updated_at = NOW()
      WHERE type = 'hotel'
        AND COALESCE(meta->>'pricing_mode', '') = 'per_pack';
    `);
  }
};
