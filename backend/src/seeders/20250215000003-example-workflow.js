'use strict';

const { ORDER_ITEM_TYPE, INVOICE_STATUS, HOTEL_PROGRESS_STATUS, VISA_PROGRESS_STATUS, TICKET_PROGRESS_STATUS, BUS_TICKET_STATUS, BUS_TRIP_STATUS } = require('../constants');

const BRANCH_JKT = 'a0000000-0000-0000-0000-000000000001';
const BRANCH_SBY = 'a0000000-0000-0000-0000-000000000002';
const OWNER1 = 'b0000000-0000-0000-0000-000000000011';
const OWNER2 = 'b0000000-0000-0000-0000-000000000012';
const OWNER3 = 'b0000000-0000-0000-0000-000000000013';
const INVOICE_USER = 'b0000000-0000-0000-0000-000000000005';
const PRODUCT_HOTEL = 'e1000000-0000-0000-0000-000000000002';
const PRODUCT_VISA = 'e1000000-0000-0000-0000-000000000003';
const PRODUCT_BUS = 'e1000000-0000-0000-0000-000000000004';
const PRODUCT_TICKET = 'e1000000-0000-0000-0000-000000000005';

const ORDER1 = '00100000-0000-0000-0000-000000000001';
const ORDER2 = '00100000-0000-0000-0000-000000000002';
const ORDER3 = '00100000-0000-0000-0000-000000000003';

const OI1_HOTEL = '0a100000-0000-0000-0000-000000000001';
const OI1_VISA = '0a100000-0000-0000-0000-000000000002';
const OI1_BUS = '0a100000-0000-0000-0000-000000000003';
const OI2_HOTEL = '0a100000-0000-0000-0000-000000000004';
const OI2_TICKET = '0a100000-0000-0000-0000-000000000005';
const OI3_BUS = '0a100000-0000-0000-0000-000000000006';

const INV1 = '00200000-0000-0000-0000-000000000001';
const INV2 = '00200000-0000-0000-0000-000000000002';
const INV3 = '00200000-0000-0000-0000-000000000003';

const PP1 = '00300000-0000-0000-0000-000000000001';
const PP2 = '00300000-0000-0000-0000-000000000002';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const dueDp = new Date(now);
    dueDp.setDate(dueDp.getDate() + 3);
    const autoCancel = new Date(now);
    autoCancel.setHours(autoCancel.getHours() + 24);

    // Product tiket (jika belum ada)
    await queryInterface.bulkInsert('products', [
      { id: PRODUCT_TICKET, type: ORDER_ITEM_TYPE.TICKET, code: 'TKT-01', name: 'Tiket Pesawat Umroh', description: 'Tiket PP Indonesia - Jeddah', is_package: false, meta: '{}', is_active: true, created_at: now, updated_at: now }
    ]).catch(() => {});
    await queryInterface.bulkInsert('product_prices', [
      { id: 'f0000000-0000-0000-0000-000000000006', product_id: PRODUCT_TICKET, branch_id: null, owner_id: null, currency: 'IDR', amount: 8500000, meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});

    // Order 1: Jakarta, owner1 - Hotel + Visa + Bus, status confirmed, total 5.500.000
    await queryInterface.bulkInsert('orders', [
      { id: ORDER1, order_number: 'ORD-2026-00001', owner_id: OWNER1, branch_id: BRANCH_JKT, total_jamaah: 10, subtotal: 5500000, discount: 0, penalty_amount: 0, total_amount: 5500000, currency: 'IDR', status: 'confirmed', created_by: INVOICE_USER, created_at: now, updated_at: now }
    ]).catch(() => {});

    await queryInterface.bulkInsert('order_items', [
      { id: OI1_HOTEL, order_id: ORDER1, type: ORDER_ITEM_TYPE.HOTEL, product_ref_id: PRODUCT_HOTEL, quantity: 1, unit_price: 2500000, subtotal: 2500000, meta: '{"room_type":"quad"}', created_at: now, updated_at: now },
      { id: OI1_VISA, order_id: ORDER1, type: ORDER_ITEM_TYPE.VISA, product_ref_id: PRODUCT_VISA, quantity: 10, unit_price: 150000, subtotal: 1500000, manifest_file_url: '/uploads/manifest/visa/MANIFEST_VISA_ORD-2026-00001_20260215.pdf', meta: '{}', created_at: now, updated_at: now },
      { id: OI1_BUS, order_id: ORDER1, type: ORDER_ITEM_TYPE.BUS, product_ref_id: PRODUCT_BUS, quantity: 35, unit_price: 50000, subtotal: 1750000, meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});

    // Order 2: Jakarta, owner2 - Hotel + Tiket, status processing, total 11.000.000
    await queryInterface.bulkInsert('orders', [
      { id: ORDER2, order_number: 'ORD-2026-00002', owner_id: OWNER2, branch_id: BRANCH_JKT, total_jamaah: 20, subtotal: 11000000, discount: 0, penalty_amount: 0, total_amount: 11000000, currency: 'IDR', status: 'processing', created_by: INVOICE_USER, created_at: now, updated_at: now }
    ]).catch(() => {});

    await queryInterface.bulkInsert('order_items', [
      { id: OI2_HOTEL, order_id: ORDER2, type: ORDER_ITEM_TYPE.HOTEL, product_ref_id: PRODUCT_HOTEL, quantity: 2, unit_price: 2500000, subtotal: 5000000, meta: '{"room_type":"double"}', created_at: now, updated_at: now },
      { id: OI2_TICKET, order_id: ORDER2, type: ORDER_ITEM_TYPE.TICKET, product_ref_id: PRODUCT_TICKET, quantity: 20, unit_price: 300000, subtotal: 6000000, manifest_file_url: '/uploads/manifest/ticket/MANIFEST_TIKET_ORD-2026-00002_20260215.pdf', meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});

    // Order 3: Surabaya, owner3 - Bus only, status tentative, total 17.500.000
    await queryInterface.bulkInsert('orders', [
      { id: ORDER3, order_number: 'ORD-2026-00003', owner_id: OWNER3, branch_id: BRANCH_SBY, total_jamaah: 35, subtotal: 17500000, discount: 0, penalty_amount: 0, total_amount: 17500000, currency: 'IDR', status: 'tentative', created_by: OWNER3, created_at: now, updated_at: now }
    ]).catch(() => {});

    await queryInterface.bulkInsert('order_items', [
      { id: OI3_BUS, order_id: ORDER3, type: ORDER_ITEM_TYPE.BUS, product_ref_id: PRODUCT_BUS, quantity: 35, unit_price: 500000, subtotal: 17500000, meta: '{}', created_at: now, updated_at: now }
    ]).catch(() => {});

    // Invoice 1: Order 1 - partial_paid (DP 1.650.000 terbayar)
    await queryInterface.bulkInsert('invoices', [
      { id: INV1, invoice_number: 'INV-2026-00001', order_id: ORDER1, owner_id: OWNER1, branch_id: BRANCH_JKT, total_amount: 5500000, dp_percentage: 30, dp_amount: 1650000, paid_amount: 1650000, remaining_amount: 3850000, status: INVOICE_STATUS.PARTIAL_PAID, due_date_dp: dueDp, due_date_full: dueDp, auto_cancel_at: autoCancel, is_blocked: false, created_at: now, updated_at: now }
    ]).catch(() => {});

    // Invoice 2: Order 2 - partial_paid (5.500.000 terbayar)
    await queryInterface.bulkInsert('invoices', [
      { id: INV2, invoice_number: 'INV-2026-00002', order_id: ORDER2, owner_id: OWNER2, branch_id: BRANCH_JKT, total_amount: 11000000, dp_percentage: 30, dp_amount: 3300000, paid_amount: 5500000, remaining_amount: 5500000, status: INVOICE_STATUS.PARTIAL_PAID, due_date_dp: dueDp, due_date_full: dueDp, auto_cancel_at: autoCancel, is_blocked: false, created_at: now, updated_at: now }
    ]).catch(() => {});

    // Invoice 3: Order 3 - tentative (belum bayar)
    await queryInterface.bulkInsert('invoices', [
      { id: INV3, invoice_number: 'INV-2026-00003', order_id: ORDER3, owner_id: OWNER3, branch_id: BRANCH_SBY, total_amount: 17500000, dp_percentage: 30, dp_amount: 5250000, paid_amount: 0, remaining_amount: 17500000, status: INVOICE_STATUS.TENTATIVE, due_date_dp: dueDp, due_date_full: dueDp, auto_cancel_at: autoCancel, is_blocked: false, created_at: now, updated_at: now }
    ]).catch(() => {});

    // Payment proof 1: INV1 - DP 1.650.000 verified
    await queryInterface.bulkInsert('payment_proofs', [
      { id: PP1, invoice_id: INV1, payment_type: 'dp', amount: 1650000, bank_name: 'BCA', account_number: '1234567890', transfer_date: now.toISOString().slice(0, 10), proof_file_url: '/uploads/payment-proofs/BUKTI_INV-2026-00001_DP_1650000_IDR_20260215_120000.pdf', uploaded_by: OWNER1, verified_by: INVOICE_USER, verified_at: now, created_at: now, updated_at: now }
    ]).catch(() => {});

    // Payment proof 2: INV2 - 5.500.000 verified
    await queryInterface.bulkInsert('payment_proofs', [
      { id: PP2, invoice_id: INV2, payment_type: 'partial', amount: 5500000, bank_name: 'Mandiri', account_number: '0987654321', transfer_date: now.toISOString().slice(0, 10), proof_file_url: '/uploads/payment-proofs/BUKTI_INV-2026-00002_partial_5500000_IDR_20260215_120000.pdf', uploaded_by: OWNER2, verified_by: INVOICE_USER, verified_at: now, created_at: now, updated_at: now }
    ]).catch(() => {});

    // HotelProgress: Order 1 hotel waiting, Order 2 hotel room_assigned
    await queryInterface.bulkInsert('hotel_progress', [
      { id: '0b100000-0000-0000-0000-000000000001', order_item_id: OI1_HOTEL, status: HOTEL_PROGRESS_STATUS.WAITING_CONFIRMATION, meal_status: 'pending', updated_at: now, created_at: now },
      { id: '0b100000-0000-0000-0000-000000000002', order_item_id: OI2_HOTEL, status: HOTEL_PROGRESS_STATUS.ROOM_ASSIGNED, room_number: '301', meal_status: 'confirmed', updated_at: now, created_at: now }
    ]).catch(() => {});

    // VisaProgress: Order 1 visa in_process
    await queryInterface.bulkInsert('visa_progress', [
      { id: '0c100000-0000-0000-0000-000000000001', order_item_id: OI1_VISA, status: VISA_PROGRESS_STATUS.IN_PROCESS, updated_at: now, created_at: now }
    ]).catch(() => {});

    // TicketProgress: Order 2 ticket seat_reserved
    await queryInterface.bulkInsert('ticket_progress', [
      { id: '0d100000-0000-0000-0000-000000000001', order_item_id: OI2_TICKET, status: TICKET_PROGRESS_STATUS.SEAT_RESERVED, updated_at: now, created_at: now }
    ]).catch(() => {});

    // BusProgress: Order 1 bus pending, Order 3 bus issued + arrival scheduled
    await queryInterface.bulkInsert('bus_progress', [
      { id: '0e100000-0000-0000-0000-000000000001', order_item_id: OI1_BUS, bus_ticket_status: BUS_TICKET_STATUS.PENDING, arrival_status: BUS_TRIP_STATUS.PENDING, departure_status: BUS_TRIP_STATUS.PENDING, return_status: BUS_TRIP_STATUS.PENDING, updated_at: now, created_at: now },
      { id: '0e100000-0000-0000-0000-000000000002', order_item_id: OI3_BUS, bus_ticket_status: BUS_TICKET_STATUS.ISSUED, bus_ticket_info: 'Bus A-01', arrival_status: BUS_TRIP_STATUS.SCHEDULED, departure_status: BUS_TRIP_STATUS.PENDING, return_status: BUS_TRIP_STATUS.PENDING, updated_at: now, created_at: now }
    ]).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('payment_proofs', null, {});
    await queryInterface.bulkDelete('invoices', null, {});
    await queryInterface.bulkDelete('bus_progress', null, {});
    await queryInterface.bulkDelete('ticket_progress', null, {});
    await queryInterface.bulkDelete('visa_progress', null, {});
    await queryInterface.bulkDelete('hotel_progress', null, {});
    await queryInterface.bulkDelete('order_items', null, {});
    await queryInterface.bulkDelete('orders', null, {});
    await queryInterface.bulkDelete('product_prices', { product_id: PRODUCT_TICKET }, {});
    await queryInterface.bulkDelete('products', { id: PRODUCT_TICKET }, {});
  }
};
