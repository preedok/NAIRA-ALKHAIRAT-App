'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'mou_fullboard_auto_calc', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'mou_fullboard_auto_calc');
  }
};
