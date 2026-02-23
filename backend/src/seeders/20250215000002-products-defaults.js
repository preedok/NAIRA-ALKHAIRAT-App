'use strict';

const { ORDER_ITEM_TYPE } = require('../constants');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const productIds = {
      handling: 'e1000000-0000-0000-0000-000000000001',
      hotel1: 'e1000000-0000-0000-0000-000000000002',
      visa1: 'e1000000-0000-0000-0000-000000000003',
      bus1: 'e1000000-0000-0000-0000-000000000004'
    };

    await queryInterface.bulkInsert('products', [
      { id: productIds.handling, type: ORDER_ITEM_TYPE.HANDLING, code: 'HDL-01', name: 'Jasa Handling', description: 'Handling general', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.hotel1, type: ORDER_ITEM_TYPE.HOTEL, code: 'HTL-MKK-01', name: 'Hotel Makkah Sample', description: 'Hotel 3 bintang', is_package: false, meta: '{"room_types":["single","double","quad","quint"]}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.visa1, type: ORDER_ITEM_TYPE.VISA, code: 'VIS-01', name: 'Visa Umroh', description: 'Visa umroh', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.bus1, type: ORDER_ITEM_TYPE.BUS, code: 'BUS-01', name: 'Bus 35 Pack', description: 'Min 35 pack', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now }
    ]).catch(() => {});

    await queryInterface.bulkInsert('product_prices', [
      { id: 'f0000000-0000-0000-0000-000000000001', product_id: productIds.handling, branch_id: null, owner_id: null, currency: 'SAR', amount: 100, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000002', product_id: productIds.handling, branch_id: null, owner_id: null, currency: 'IDR', amount: 420000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000003', product_id: productIds.hotel1, branch_id: null, owner_id: null, currency: 'IDR', amount: 2500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000004', product_id: productIds.visa1, branch_id: null, owner_id: null, currency: 'IDR', amount: 1500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000005', product_id: productIds.bus1, branch_id: null, owner_id: null, currency: 'IDR', amount: 500000, meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('product_prices', null, {});
    await queryInterface.bulkDelete('products', null, {});
  }
};
