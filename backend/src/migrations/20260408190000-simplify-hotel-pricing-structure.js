'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = (COALESCE(meta, '{}'::jsonb) - 'meal_plan' - 'mou_fullboard_auto_calc' - 'mou_manual_has_meal')
      WHERE type = 'hotel'
    `);

    await queryInterface.sequelize.query(`
      UPDATE hotel_monthly_prices
      SET with_meal = false
      WHERE component = 'room' AND with_meal = true
    `);
  },

  async down() {
    // No-op rollback: this migration normalizes legacy hotel pricing data.
  }
};

