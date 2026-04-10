'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('owner_profiles', ['is_mou_owner'], {
      name: 'idx_owner_profiles_is_mou_owner'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('owner_profiles', 'idx_owner_profiles_is_mou_owner');
  }
};
