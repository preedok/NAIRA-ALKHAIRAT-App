'use strict';

/**
 * - Order: status DP (tagihan_dp / pembayaran_dp), persen DP dari total tagihan, nominal per mata uang.
 * - Invoice: nominal total & paid per mata uang (IDR, SAR).
 * - PaymentProof: nominal per mata uang (amount_idr, amount_sar) selalu disimpan.
 * - Order: order_updated_at = waktu terakhir order diubah (untuk tampil di FE).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Orders: status pembayaran DP, persen DP, nominal per mata uang, tanggal update order (untuk tampil)
    await queryInterface.addColumn('orders', 'dp_payment_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'tagihan_dp = belum bayar DP, pembayaran_dp = sudah ada bukti bayar DP'
    }).catch(() => {});
    await queryInterface.addColumn('orders', 'dp_percentage_paid', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Persen pembayaran DP dari total tagihan terbaru (0-100)'
    }).catch(() => {});
    await queryInterface.addColumn('orders', 'total_amount_idr', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Total order dalam IDR (selalu disimpan)'
    }).catch(() => {});
    await queryInterface.addColumn('orders', 'total_amount_sar', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Total order dalam SAR jika ada'
    }).catch(() => {});
    await queryInterface.addColumn('orders', 'order_updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Tanggal terakhir order diubah (untuk tampil di invoice/progress)'
    }).catch(() => {});

    // Invoices: nominal per mata uang
    await queryInterface.addColumn('invoices', 'total_amount_idr', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Total tagihan dalam IDR'
    }).catch(() => {});
    await queryInterface.addColumn('invoices', 'total_amount_sar', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Total tagihan dalam SAR jika ada'
    }).catch(() => {});
    await queryInterface.addColumn('invoices', 'paid_amount_idr', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total sudah dibayar dalam IDR'
    }).catch(() => {});
    await queryInterface.addColumn('invoices', 'paid_amount_sar', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total sudah dibayar dalam SAR jika ada'
    }).catch(() => {});

    // Payment proofs: nominal per mata uang selalu disimpan
    await queryInterface.addColumn('payment_proofs', 'amount_idr', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Nominal transaksi dalam IDR'
    }).catch(() => {});
    await queryInterface.addColumn('payment_proofs', 'amount_sar', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: 'Nominal transaksi dalam SAR jika ada'
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'dp_payment_status').catch(() => {});
    await queryInterface.removeColumn('orders', 'dp_percentage_paid').catch(() => {});
    await queryInterface.removeColumn('orders', 'total_amount_idr').catch(() => {});
    await queryInterface.removeColumn('orders', 'total_amount_sar').catch(() => {});
    await queryInterface.removeColumn('orders', 'order_updated_at').catch(() => {});
    await queryInterface.removeColumn('invoices', 'total_amount_idr').catch(() => {});
    await queryInterface.removeColumn('invoices', 'total_amount_sar').catch(() => {});
    await queryInterface.removeColumn('invoices', 'paid_amount_idr').catch(() => {});
    await queryInterface.removeColumn('invoices', 'paid_amount_sar').catch(() => {});
    await queryInterface.removeColumn('payment_proofs', 'amount_idr').catch(() => {});
    await queryInterface.removeColumn('payment_proofs', 'amount_sar').catch(() => {});
  }
};
