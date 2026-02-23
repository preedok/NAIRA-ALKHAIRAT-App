'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('app_settings', [
      { id: 'd0000000-0000-0000-0000-000000000001', key: 'locale', value: 'id', description: 'Default language', created_at: now, updated_at: now },
      { id: 'd0000000-0000-0000-0000-000000000002', key: 'primary_color', value: '#059669', description: 'Primary theme color', created_at: now, updated_at: now },
      { id: 'd0000000-0000-0000-0000-000000000003', key: 'background_color', value: '#f8fafc', description: 'Background color', created_at: now, updated_at: now },
      { id: 'd0000000-0000-0000-0000-000000000004', key: 'text_color', value: '#0f172a', description: 'Text color', created_at: now, updated_at: now },
      { id: 'd0000000-0000-0000-0000-000000000005', key: 'font_size', value: '14', description: 'Base font size px', created_at: now, updated_at: now }
    ]).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('app_settings', null, {});
  }
};
