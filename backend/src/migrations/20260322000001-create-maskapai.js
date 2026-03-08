'use strict';

const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

/** Master data maskapai (airline) untuk produk tiket */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('maskapai', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    const now = new Date();
    await queryInterface.bulkInsert('maskapai', [
      { id: uuid(), code: 'lion', name: 'Lion Air', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'garuda', name: 'Garuda Indonesia', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'batik', name: 'Batik Air', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'citilink', name: 'Citilink', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'sriwijaya', name: 'Sriwijaya Air', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'nam', name: 'NAM Air', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'super_jet', name: 'Super Air Jet', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'transnusa', name: 'TransNusa', is_active: true, created_at: now, updated_at: now },
      { id: uuid(), code: 'other', name: 'Lainnya', is_active: true, created_at: now, updated_at: now }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('maskapai');
  }
};
