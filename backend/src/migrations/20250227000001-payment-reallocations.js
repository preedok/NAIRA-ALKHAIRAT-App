'use strict';

/**
 * Payment Reallocation: pemindahan dana dari invoice sumber (canceled/overpaid) ke invoice penerima.
 * Satu atau lebih sumber -> satu atau lebih penerima; tiap baris = satu transfer (source -> target, amount).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_reallocations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      source_invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      target_invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        comment: 'Jumlah yang dipindahkan (IDR)'
      },
      performed_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
    await queryInterface.addIndex('payment_reallocations', ['source_invoice_id']);
    await queryInterface.addIndex('payment_reallocations', ['target_invoice_id']);
    await queryInterface.addIndex('payment_reallocations', ['performed_by']);
    await queryInterface.addIndex('payment_reallocations', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_reallocations');
  }
};
