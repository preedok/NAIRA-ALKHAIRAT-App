'use strict';

/** Add check_in_time, check_out_time to hotel_progress for jamaah status auto (sudah masuk room / keluar room). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('hotel_progress', 'check_in_time', { type: Sequelize.STRING(5), allowNull: true });
    await queryInterface.addColumn('hotel_progress', 'check_out_time', { type: Sequelize.STRING(5), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('hotel_progress', 'check_in_time');
    await queryInterface.removeColumn('hotel_progress', 'check_out_time');
  }
};
