'use strict';

/** Waktu transfer sesuai bukti (tanggal, jam, menit, detik) — diisi admin saat upload bukti. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('refunds', 'proof_transfer_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Tanggal/waktu di bukti transfer (bukan waktu server)'
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('refunds', 'proof_transfer_at');
  }
};
