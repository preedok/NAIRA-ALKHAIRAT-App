'use strict';

/**
 * Rekap Hotel module: table rekap_hotel + role role_rekap_hotel.
 * Standalone, tidak terhubung Order/Invoice/Product.
 */
const ENUM_TYPE = 'enum_users_role';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;

    await queryInterface.createTable('rekap_hotel', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      source_type: { type: Sequelize.STRING(32), allowNull: false },
      period_name: { type: Sequelize.STRING(120), allowNull: true },
      season_year: { type: Sequelize.STRING(20), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      tentative: { type: Sequelize.STRING(60), allowNull: true },
      definite: { type: Sequelize.STRING(60), allowNull: true },
      client: { type: Sequelize.STRING(200), allowNull: true },
      paket: { type: Sequelize.STRING(120), allowNull: true },
      hotel_makkah: { type: Sequelize.STRING(200), allowNull: true },
      hotel_madinah: { type: Sequelize.STRING(200), allowNull: true },
      pax: { type: Sequelize.INTEGER, allowNull: true },
      ket: { type: Sequelize.STRING(100), allowNull: true },
      location: { type: Sequelize.STRING(20), allowNull: true },
      hotel_name: { type: Sequelize.STRING(200), allowNull: true },
      room_7bed: { type: Sequelize.STRING(20), allowNull: true },
      room_6bed: { type: Sequelize.STRING(20), allowNull: true },
      room_quint: { type: Sequelize.STRING(20), allowNull: true },
      room_quad: { type: Sequelize.STRING(20), allowNull: true },
      room_triple: { type: Sequelize.STRING(20), allowNull: true },
      room_double: { type: Sequelize.STRING(20), allowNull: true },
      total_room: { type: Sequelize.STRING(30), allowNull: true },
      status: { type: Sequelize.STRING(32), allowNull: true },
      ref_number: { type: Sequelize.STRING(60), allowNull: true },
      hotel_combo: { type: Sequelize.STRING(300), allowNull: true },
      bandara: { type: Sequelize.STRING(20), allowNull: true },
      paket_type: { type: Sequelize.STRING(60), allowNull: true },
      paket_label: { type: Sequelize.STRING(120), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      extra_notes: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    try {
      await q.query(`ALTER TYPE "${ENUM_TYPE}" ADD VALUE 'role_rekap_hotel'`);
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rekap_hotel');
    // PostgreSQL cannot remove enum value; leave role_rekap_hotel in enum.
  }
};
