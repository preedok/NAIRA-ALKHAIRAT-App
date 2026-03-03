'use strict';

/**
 * Tambah kolom bank pengirim (nama rekening, nomor rekening) dan rekening penerima (FK ke accounting_bank_accounts).
 * - sender_account_name, sender_account_number: data pengirim transfer
 * - recipient_bank_account_id: rekening perusahaan (Data Rekening Bank) yang menerima
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (!tableInfo.sender_account_name) {
      await queryInterface.addColumn('payment_proofs', 'sender_account_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Nama rekening pengirim (transfer dari)'
      });
    }
    if (!tableInfo.sender_account_number) {
      await queryInterface.addColumn('payment_proofs', 'sender_account_number', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Nomor rekening pengirim'
      });
    }
    if (!tableInfo.recipient_bank_account_id) {
      await queryInterface.addColumn('payment_proofs', 'recipient_bank_account_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'accounting_bank_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Rekening penerima (dari Data Rekening Bank)'
      });
      await queryInterface.addIndex('payment_proofs', ['recipient_bank_account_id']);
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (tableInfo.sender_account_name) await queryInterface.removeColumn('payment_proofs', 'sender_account_name');
    if (tableInfo.sender_account_number) await queryInterface.removeColumn('payment_proofs', 'sender_account_number');
    if (tableInfo.recipient_bank_account_id) {
      await queryInterface.removeColumn('payment_proofs', 'recipient_bank_account_id');
    }
  }
};
