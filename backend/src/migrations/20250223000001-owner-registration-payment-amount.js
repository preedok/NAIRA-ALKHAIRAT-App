'use strict';

/** owner_profiles: jumlah pembayaran MoU yang diinput saat daftar (flow: bayar di awal daftar) */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('owner_profiles', 'registration_payment_amount', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Jumlah pembayaran MoU (IDR) yang diinput saat registrasi'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('owner_profiles', 'registration_payment_amount');
  }
};
