'use strict';

/** Tambah is_mou_owner ke owner_profiles: owner dengan MOU dapat harga diskon (setting % di business rules). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'owner_profiles',
      'is_mou_owner',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'true = owner MOU dapat harga diskon produk (persen diatur di Settings)'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('owner_profiles', 'is_mou_owner');
  }
};
