'use strict';

/** owner_profiles: kolom bukti bayar pendaftaran + MOU hasil generate sistem */
async function addColumnIfMissing(queryInterface, Sequelize, table, column, definition) {
  const q = queryInterface.sequelize;
  const [rows] = await q.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :table AND column_name = :column LIMIT 1`,
    { replacements: { table, column } }
  );
  if (rows && rows.length > 0) return;
  await queryInterface.addColumn(table, column, definition);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'owner_profiles';
    await addColumnIfMissing(queryInterface, Sequelize, table, 'registration_payment_proof_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'registration_payment_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'registration_payment_verified_by', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'mou_generated_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  },

  async down(queryInterface) {
    const table = 'owner_profiles';
    await queryInterface.removeColumn(table, 'registration_payment_proof_url').catch(() => {});
    await queryInterface.removeColumn(table, 'registration_payment_verified_at').catch(() => {});
    await queryInterface.removeColumn(table, 'registration_payment_verified_by').catch(() => {});
    await queryInterface.removeColumn(table, 'mou_generated_url').catch(() => {});
  }
};
