'use strict';

/**
 * Master data: tabel kabupaten/kota
 * Relasi: provinsi hasMany kabupaten (satu provinsi punya banyak kabupaten/kota)
 * Data diisi via seeder dari API data-indonesia atau manual.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('kabupaten', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      kode: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Kode BPS/Kemendagri (e.g. 3201, 3273)'
      },
      nama: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      provinsi_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'provinsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    await queryInterface.addIndex('kabupaten', ['provinsi_id']);
    await queryInterface.addIndex('kabupaten', ['kode'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('kabupaten');
  }
};
