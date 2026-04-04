'use strict';

/**
 * Kolom component: 'room' | 'meal'
 * - room: harga kamar per malam (per tipe, with_meal sesuai paket)
 * - meal: harga makan SAR per orang per malam (satu baris per bulan, room_type = __meal__)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('hotel_monthly_prices', 'component', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'room'
    });
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
        component
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');
    await queryInterface.removeColumn('hotel_monthly_prices', 'component');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX uq_hmp_layer_month_variant
      ON hotel_monthly_prices (
        product_id,
        COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
        year_month,
        currency,
        room_type,
        with_meal
      )
    `);
  }
};
