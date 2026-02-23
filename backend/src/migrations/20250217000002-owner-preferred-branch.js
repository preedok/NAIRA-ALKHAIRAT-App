'use strict';

/**
 * Menambah preferred_branch_id ke owner_profiles.
 * Owner pilih kabupaten saat registrasi -> sistem auto-detect provinsi & koordinator dari branch.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [exists] = await queryInterface.sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owner_profiles' AND column_name = 'preferred_branch_id';
    `);
    if (!exists || exists.length === 0) {
      await queryInterface.addColumn('owner_profiles', 'preferred_branch_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'branches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('owner_profiles', 'preferred_branch_id').catch(() => {});
  }
};
