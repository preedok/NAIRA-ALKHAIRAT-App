'use strict';

/**
 * Hotel data per musim + inventori kamar per musim.
 * Availability per tanggal dihitung real-time: inventory musim - booked (dari order_items).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('hotel_seasons', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nama musim, e.g. Ramadhan 2025, High Season Jan-Mar'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      meta: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' }
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('hotel_seasons', ['product_id']);
    await queryInterface.addIndex('hotel_seasons', ['product_id', 'start_date', 'end_date']);

    await queryInterface.createTable('hotel_room_inventory', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      season_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'hotel_seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      room_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'single, double, triple, quad, quint'
      },
      total_rooms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('hotel_room_inventory', ['product_id', 'season_id']);
    await queryInterface.addIndex('hotel_room_inventory', ['season_id', 'room_type'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('hotel_room_inventory');
    await queryInterface.dropTable('hotel_seasons');
  }
};
