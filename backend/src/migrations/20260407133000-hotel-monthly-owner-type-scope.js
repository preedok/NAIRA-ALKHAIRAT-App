'use strict';

/**
 * Menambah scope harga bulanan hotel per tipe owner:
 * - mou: khusus owner MOU
 * - non_mou: khusus owner Non-MOU
 * - all: fallback umum
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('hotel_monthly_prices', 'owner_type_scope', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'all'
    });

    await queryInterface.sequelize.query(`
      UPDATE hotel_monthly_prices
      SET owner_type_scope = 'all'
      WHERE owner_type_scope IS NULL OR owner_type_scope = ''
    `);

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_hmp_layer_month_variant
      ON hotel_monthly_prices (
        product_id,
        COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
        year_month,
        currency,
        room_type,
        with_meal,
        component,
        owner_type_scope
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');
    await queryInterface.removeColumn('hotel_monthly_prices', 'owner_type_scope');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_hmp_layer_month_variant
      ON hotel_monthly_prices (
        product_id,
        COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
        year_month,
        currency,
        room_type,
        with_meal,
        component
      )
    `);
  }
};
