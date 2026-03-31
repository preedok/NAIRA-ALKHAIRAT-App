'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add enum value to products.type if enum type exists.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_products_type') THEN
          ALTER TYPE "enum_products_type" ADD VALUE IF NOT EXISTS 'siskopatuh';
        END IF;
      END $$;
    `);

    // Add enum value to order_items.type if enum type exists.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_order_items_type') THEN
          ALTER TYPE "enum_order_items_type" ADD VALUE IF NOT EXISTS 'siskopatuh';
        END IF;
      END $$;
    `);

    const now = new Date();
    const productId = 'e1000000-0000-0000-0000-000000000007';

    await queryInterface.bulkInsert('products', [{
      id: productId,
      type: 'siskopatuh',
      code: 'SKP-01',
      name: 'Siskopatuh',
      description: 'Produk layanan Siskopatuh',
      is_package: false,
      meta: JSON.stringify({ siskopatuh_kinds: ['reguler'] }),
      is_active: true,
      created_at: now,
      updated_at: now
    }]).catch(() => {});

    await queryInterface.bulkInsert('product_prices', [{
      id: 'f0000000-0000-0000-0000-000000000008',
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
    await queryInterface.bulkDelete('product_prices', { id: 'f0000000-0000-0000-0000-000000000008' }, {});
    await queryInterface.bulkDelete('products', { id: 'e1000000-0000-0000-0000-000000000007' }, {});
  }
};

