'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_type') THEN
          ALTER TYPE "enum_products_type" ADD VALUE IF NOT EXISTS 'haji_dakhili';
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_order_items_type') THEN
          ALTER TYPE "enum_order_items_type" ADD VALUE IF NOT EXISTS 'haji_dakhili';
        END IF;
      END $$;
    `);

    const now = new Date();
    const productId = 'e1000000-0000-0000-0000-000000000008';

    await queryInterface.bulkInsert('products', [{
      id: productId,
      type: 'haji_dakhili',
      code: 'HDK-01',
      name: 'Haji Dakhili',
      description: 'Produk layanan Haji Dakhili (haji dalam negeri)',
      is_package: false,
      meta: JSON.stringify({ haji_dakhili_kinds: ['reguler'] }),
      is_active: true,
      created_at: now,
      updated_at: now
    }]).catch(() => {});

    await queryInterface.bulkInsert('product_prices', [{
      id: 'f0000000-0000-0000-0000-000000000009',
      product_id: productId,
      branch_id: null,
      owner_id: null,
      currency: 'IDR',
      amount: 500000,
      meta: '{}',
      created_at: now,
      updated_at: now
    }]).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('product_prices', { id: 'f0000000-0000-0000-0000-000000000009' }, {});
    await queryInterface.bulkDelete('products', { id: 'e1000000-0000-0000-0000-000000000008' }, {});
  }
};
