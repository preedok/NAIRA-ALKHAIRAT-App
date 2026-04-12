'use strict';

/** Add wilayah_id to business_rule_configs for per-wilayah rules (e.g. visa, tiket). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const [cols] = await q.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'business_rule_configs' AND column_name = 'wilayah_id'
      LIMIT 1
    `);
    if (cols && cols.length > 0) return;
    await queryInterface.addColumn(
      'business_rule_configs',
      'wilayah_id',
      { type: Sequelize.UUID, references: { model: 'wilayah', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL', allowNull: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('business_rule_configs', 'wilayah_id');
  }
};
