'use strict';

/** Add wilayah_id to business_rule_configs for per-wilayah rules (e.g. visa, tiket). */
module.exports = {
  async up(queryInterface, Sequelize) {
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
