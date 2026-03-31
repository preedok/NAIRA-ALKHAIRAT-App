'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('orders', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.changeColumn('invoices', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('orders', 'owner_name_manual', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'owner_phone_manual', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'owner_input_mode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'registered'
    });

    await queryInterface.addColumn('invoices', 'owner_name_manual', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('invoices', 'owner_phone_manual', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('invoices', 'owner_input_mode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'registered'
    });

    await queryInterface.sequelize.query(`
      UPDATE invoices i
      SET owner_name_manual = o.owner_name_manual,
          owner_phone_manual = o.owner_phone_manual,
          owner_input_mode = COALESCE(o.owner_input_mode, 'registered')
      FROM orders o
      WHERE i.order_id = o.id
        AND (i.owner_name_manual IS NULL OR i.owner_phone_manual IS NULL OR i.owner_input_mode IS NULL)
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('invoices', 'owner_input_mode');
    await queryInterface.removeColumn('invoices', 'owner_phone_manual');
    await queryInterface.removeColumn('invoices', 'owner_name_manual');
    await queryInterface.removeColumn('orders', 'owner_input_mode');
    await queryInterface.removeColumn('orders', 'owner_phone_manual');
    await queryInterface.removeColumn('orders', 'owner_name_manual');

    await queryInterface.changeColumn('invoices', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    });
    await queryInterface.changeColumn('orders', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  }
};

