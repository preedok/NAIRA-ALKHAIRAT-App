'use strict';

/**
 * - owner_profiles.balance: saldo owner (dari pembatalan order yang dijadikan saldo)
 * - refunds: bank_name, account_number, source (cancel|balance); invoice_id/order_id nullable untuk refund dari saldo
 * - owner_balance_transactions: riwayat saldo (credit/debit)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('owner_profiles', 'balance', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('refunds', 'bank_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('refunds', 'account_number', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('refunds', 'source', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'cancel'
    });
    await queryInterface.addColumn('refunds', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.changeColumn('refunds', 'invoice_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'invoices', key: 'id' }
    });
    await queryInterface.changeColumn('refunds', 'order_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'orders', key: 'id' }
    });

    await queryInterface.createTable('owner_balance_transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      owner_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        comment: 'Positive = credit (saldo naik), negative = debit (saldo turun)'
      },
      type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'cancel_credit, allocation, refund_debit, adjustment'
      },
      reference_type: {
        type: Sequelize.STRING(30),
        allowNull: true,
        comment: 'order, invoice, refund'
      },
      reference_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('owner_balance_transactions', ['owner_id']);
    await queryInterface.addIndex('owner_balance_transactions', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('owner_balance_transactions');
    await queryInterface.removeColumn('refunds', 'owner_id');
    await queryInterface.removeColumn('refunds', 'source');
    await queryInterface.removeColumn('refunds', 'account_number');
    await queryInterface.removeColumn('refunds', 'bank_name');
    await queryInterface.changeColumn('refunds', 'invoice_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'invoices', key: 'id' }
    });
    await queryInterface.changeColumn('refunds', 'order_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'orders', key: 'id' }
    });
    await queryInterface.removeColumn('owner_profiles', 'balance');
  }
};
