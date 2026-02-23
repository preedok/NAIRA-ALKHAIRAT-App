'use strict';

/**
 * owner_profiles.activation_generated_password
 * Menyimpan password yang digenerate sistem saat aktivasi owner.
 * Ditampilkan di Admin Pusat (tabel user + modal edit). Dikosongkan saat admin mengubah password user.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('owner_profiles', 'activation_generated_password', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('owner_profiles', 'activation_generated_password');
  }
};
