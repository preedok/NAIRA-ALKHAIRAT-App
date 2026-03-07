'use strict';

/**
 * Set semua owner yang sudah ada menjadi tipe MOU (is_mou_owner = true).
 * Fitur MOU vs non-MOU baru; owner yang ada dianggap MOU. Owner baru bisa diset MOU/Non-MOU saat aktivasi.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('UPDATE owner_profiles SET is_mou_owner = true');
  },

  async down() {
    // Tidak revert: membiarkan is_mou_owner apa adanya
  }
};
