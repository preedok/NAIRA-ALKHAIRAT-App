'use strict';

/**
 * Tambah audit trail:
 * - invoice_status_histories: semua perubahan status invoice (siapa/kapan/dari->ke/reason/meta)
 * - order_revisions: riwayat perubahan item order (diff) yang mempengaruhi invoice
 * - invoices.order_updated_at, invoices.last_order_revision_id
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_status_histories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      from_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      to_status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      changed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reason: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      meta: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
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

    await queryInterface.addIndex('invoice_status_histories', ['invoice_id', 'changed_at']);
    await queryInterface.addIndex('invoice_status_histories', ['to_status']);

    await queryInterface.createTable('order_revisions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      revision_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      changed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      diff: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      totals_before: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      totals_after: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
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

    await queryInterface.addIndex('order_revisions', ['order_id', 'revision_no'], { unique: true });
    await queryInterface.addIndex('order_revisions', ['invoice_id', 'changed_at']);

    // invoices: marker untuk UI "Pembayaran DP + Update Invoice"
    await queryInterface.addColumn('invoices', 'order_updated_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('invoices', 'last_order_revision_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'order_revisions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('invoices', ['order_updated_at']);
    await queryInterface.addIndex('invoices', ['last_order_revision_id']);
  },

  async down(queryInterface) {
    // Drop columns first (depend on order_revisions)
    try { await queryInterface.removeIndex('invoices', ['last_order_revision_id']); } catch (e) {}
    try { await queryInterface.removeIndex('invoices', ['order_updated_at']); } catch (e) {}
    try { await queryInterface.removeColumn('invoices', 'last_order_revision_id'); } catch (e) {}
    try { await queryInterface.removeColumn('invoices', 'order_updated_at'); } catch (e) {}

    await queryInterface.dropTable('invoice_status_histories');
    await queryInterface.dropTable('order_revisions');
  }
};

