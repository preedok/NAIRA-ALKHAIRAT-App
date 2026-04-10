'use strict';

const { ORDER_ITEM_TYPE, VISA_KIND } = require('../constants');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const productIds = {
      handling: 'e1000000-0000-0000-0000-000000000001',
      hotel1: 'e1000000-0000-0000-0000-000000000002',
      visa1: 'e1000000-0000-0000-0000-000000000003',
      visa2: 'e1000000-0000-0000-0000-000000000005',
      visa3: 'e1000000-0000-0000-0000-000000000006',
      bus1: 'e1000000-0000-0000-0000-000000000004',
      siskopatuh1: 'e1000000-0000-0000-0000-000000000007'
    };

    await queryInterface.bulkInsert('products', [
      { id: productIds.handling, type: ORDER_ITEM_TYPE.HANDLING, code: 'HDL-01', name: 'Jasa Handling', description: 'Handling general', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.hotel1, type: ORDER_ITEM_TYPE.HOTEL, code: 'HTL-MKK-01', name: 'Hotel Makkah Sample', description: 'Hotel 3 bintang', is_package: false, meta: '{"room_types":["double","quad","quint"]}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.visa1, type: ORDER_ITEM_TYPE.VISA, code: 'VIS-ONLY-01', name: 'Visa Umroh (Visa Only)', description: 'Visa umroh standar', is_package: false, meta: JSON.stringify({ visa_kind: VISA_KIND.ONLY }), is_active: true, created_at: now, updated_at: now },
      { id: productIds.visa2, type: ORDER_ITEM_TYPE.VISA, code: 'VIS-TASREH-01', name: 'Visa Umroh + Tasreh', description: 'Visa umroh dengan tasreh', is_package: false, meta: JSON.stringify({ visa_kind: VISA_KIND.TASREH }), is_active: true, created_at: now, updated_at: now },
      { id: productIds.visa3, type: ORDER_ITEM_TYPE.VISA, code: 'VIS-PREMIUM-01', name: 'Visa Umroh Premium', description: 'Visa umroh premium', is_package: false, meta: JSON.stringify({ visa_kind: VISA_KIND.PREMIUM }), is_active: true, created_at: now, updated_at: now },
      { id: productIds.bus1, type: ORDER_ITEM_TYPE.BUS, code: 'BUS-01', name: 'Bus 35 Pack', description: 'Min 35 pack', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now },
      { id: productIds.siskopatuh1, type: ORDER_ITEM_TYPE.SISKOPATUH, code: 'SKP-01', name: 'Siskopatuh', description: 'Layanan Siskopatuh', is_package: false, meta: JSON.stringify({ siskopatuh_kinds: ['reguler'] }), is_active: true, created_at: now, updated_at: now }
    ]).catch(() => {});

    await queryInterface.bulkInsert('product_prices', [
      { id: 'f0000000-0000-0000-0000-000000000001', product_id: productIds.handling, kota_id: null, owner_id: null, currency: 'SAR', amount: 100, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000002', product_id: productIds.handling, kota_id: null, owner_id: null, currency: 'IDR', amount: 420000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000003', product_id: productIds.hotel1, kota_id: null, owner_id: null, currency: 'IDR', amount: 2500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000004', product_id: productIds.visa1, kota_id: null, owner_id: null, currency: 'IDR', amount: 1500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000006', product_id: productIds.visa2, kota_id: null, owner_id: null, currency: 'IDR', amount: 2000000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000007', product_id: productIds.visa3, kota_id: null, owner_id: null, currency: 'IDR', amount: 2500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000005', product_id: productIds.bus1, kota_id: null, owner_id: null, currency: 'IDR', amount: 500000, meta: '{}', created_at: now, updated_at: now },
      { id: 'f0000000-0000-0000-0000-000000000008', product_id: productIds.siskopatuh1, kota_id: null, owner_id: null, currency: 'IDR', amount: 500000, meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('product_prices', null, {});
    await queryInterface.bulkDelete('products', null, {});
  }
};
