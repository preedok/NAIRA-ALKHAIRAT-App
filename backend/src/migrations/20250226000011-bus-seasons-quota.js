'use strict';

/**
 * Kalender bus: musim (periode tanggal) + kuota per musim.
 * Booked = sum(quantity) dari order_items type=bus dengan meta.travel_date = tanggal.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bus_seasons', {
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
        comment: 'Nama periode, e.g. Ramadhan 2025'
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
    await queryInterface.addIndex('bus_seasons', ['product_id']);
    await queryInterface.addIndex('bus_seasons', ['product_id', 'start_date', 'end_date']);

    await queryInterface.createTable('bus_season_quota', {
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
        references: { model: 'bus_seasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      quota: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Kuota bus (slot/kursi) untuk periode ini'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('bus_season_quota', ['product_id', 'season_id']);
    await queryInterface.addIndex('bus_season_quota', ['season_id'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bus_season_quota');
    await queryInterface.dropTable('bus_seasons');
  }
};
