'use strict';

/** Order: waive_bus_penalty = pakai Hiace (1x) instead of bus penalty; item Hiace qty 1 ditambah otomatis dan tampil di progress bus. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'waive_bus_penalty', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Jika true: tidak ada penalti bus, order dianggap pakai 1 Hiace (ditambah otomatis), tampil di progress bus'
    }).catch(() => {});
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'waive_bus_penalty').catch(() => {});
  }
};
