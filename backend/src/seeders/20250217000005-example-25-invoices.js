'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { INVOICE_STATUS, ORDER_STATUS, ORDER_ITEM_TYPE } = require('../constants');

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }));

const BRANCHES = ['a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'];
const OWNERS = ['b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000013'];
const PRODUCTS = ['e1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000005'];
const INVOICE_USER = 'b0000000-0000-0000-0000-000000000005';

const INVOICE_STATUSES = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.TENTATIVE,
  INVOICE_STATUS.TENTATIVE,
  INVOICE_STATUS.PARTIAL_PAID,
  INVOICE_STATUS.PARTIAL_PAID,
  INVOICE_STATUS.PARTIAL_PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.PROCESSING,
  INVOICE_STATUS.PROCESSING,
  INVOICE_STATUS.COMPLETED,
  INVOICE_STATUS.COMPLETED,
  INVOICE_STATUS.OVERDUE,
  INVOICE_STATUS.CANCELED,
  INVOICE_STATUS.REFUNDED,
  INVOICE_STATUS.ORDER_UPDATED,
  INVOICE_STATUS.OVERPAID,
  INVOICE_STATUS.OVERPAID_TRANSFERRED,
  INVOICE_STATUS.OVERPAID_RECEIVED,
  INVOICE_STATUS.REFUND_CANCELED,
  INVOICE_STATUS.OVERPAID_REFUND_PENDING,
  INVOICE_STATUS.TENTATIVE,
  INVOICE_STATUS.PARTIAL_PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.COMPLETED,
  INVOICE_STATUS.CANCELED
];

const ORDER_STATUSES = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.TENTATIVE,
  ORDER_STATUS.TENTATIVE,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.TENTATIVE,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.TENTATIVE,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // Clean existing data so seeder is re-runnable
    const [existingOrders] = await queryInterface.sequelize.query("SELECT id FROM orders WHERE order_number >= 'ORD-2026-00004' AND order_number <= 'ORD-2026-00028'").catch(() => [[]]);
    const orderIds = (existingOrders || []).map((o) => o.id);
    if (orderIds.length > 0) {
      const [invoices] = await queryInterface.sequelize.query(
        `SELECT id FROM invoices WHERE order_id IN (${orderIds.map((id) => `'${id}'`).join(',')})`
      ).catch(() => [[]]);
      const invoiceIds = (invoices || []).map((i) => i.id);
      if (invoiceIds.length > 0) {
        await queryInterface.bulkDelete('payment_proofs', { invoice_id: { [Op.in]: invoiceIds } }).catch(() => {});
      }
      await queryInterface.bulkDelete('invoices', { order_id: { [Op.in]: orderIds } }).catch(() => {});
      await queryInterface.bulkDelete('order_items', { order_id: { [Op.in]: orderIds } }).catch(() => {});
      await queryInterface.bulkDelete('orders', { id: { [Op.in]: orderIds } }).catch(() => {});
    }

    const now = new Date();
    const dueDp = new Date(now);
    dueDp.setDate(dueDp.getDate() + 3);
    const autoCancel = new Date(now);
    autoCancel.setHours(autoCancel.getHours() + 48);

    const orders = [];
    const orderItems = [];
    const invoices = [];
    const paymentProofs = [];

    for (let i = 0; i < 25; i++) {
      const orderId = uuid();
      const orderItemId = uuid();
      const invoiceId = uuid();
      const n = i + 4;
      const orderNum = `ORD-2026-${String(n).padStart(5, '0')}`;
      const invNum = `INV-2026-${String(n).padStart(5, '0')}`;

      const totalAmount = [3500000, 5500000, 8500000, 11000000, 17500000, 22000000, 45000000][i % 7];
      const dpPct = 30;
      const dpAmount = Math.round(totalAmount * dpPct / 100);
      const ordStatus = ORDER_STATUSES[i];
      const invStatus = INVOICE_STATUSES[i];

      let paidAmount = 0;
      if (['partial_paid', 'paid', 'processing', 'completed', 'overpaid', 'overpaid_transferred', 'overpaid_received', 'overpaid_refund_pending'].includes(invStatus)) {
        paidAmount = invStatus === 'paid' || invStatus === 'completed' ? totalAmount : (invStatus.includes('overpaid') ? totalAmount + 500000 : dpAmount);
      }
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const isBlocked = invStatus === INVOICE_STATUS.TENTATIVE && i === 1;

      orders.push({
        id: orderId,
        order_number: orderNum,
        owner_id: OWNERS[i % 3],
        branch_id: BRANCHES[i % 3],
        total_jamaah: 10 + (i % 25),
        subtotal: totalAmount,
        discount: 0,
        penalty_amount: 0,
        total_amount: totalAmount,
        currency: 'IDR',
        status: ordStatus,
        created_by: INVOICE_USER,
        created_at: now,
        updated_at: now
      });

      orderItems.push({
        id: orderItemId,
        order_id: orderId,
        type: ORDER_ITEM_TYPE.HOTEL,
        product_ref_id: PRODUCTS[i % 4],
        quantity: 1 + (i % 3),
        unit_price: Math.round(totalAmount / (1 + (i % 3))),
        subtotal: totalAmount,
        meta: '{}',
        created_at: now,
        updated_at: now
      });

      invoices.push({
        id: invoiceId,
        invoice_number: invNum,
        order_id: orderId,
        owner_id: OWNERS[i % 3],
        branch_id: BRANCHES[i % 3],
        total_amount: totalAmount,
        dp_percentage: dpPct,
        dp_amount: dpAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status: invStatus,
        issued_at: now,
        due_date_dp: dueDp,
        due_date_full: dueDp,
        auto_cancel_at: isBlocked ? new Date(now.getTime() - 86400000) : autoCancel,
        is_blocked: isBlocked,
        created_at: now,
        updated_at: now
      });

      if (['partial_paid', 'paid', 'processing', 'completed', 'overpaid', 'overpaid_transferred', 'overpaid_received', 'overpaid_refund_pending'].includes(invStatus) && paidAmount > 0) {
        paymentProofs.push({
          id: uuid(),
          invoice_id: invoiceId,
          payment_type: paidAmount >= totalAmount ? 'full' : (paidAmount >= dpAmount ? 'partial' : 'dp'),
          amount: paidAmount >= totalAmount ? totalAmount : dpAmount,
          bank_name: ['BCA', 'Mandiri', 'BRI', 'BNI'][i % 4],
          account_number: String(1000000000 + i),
          transfer_date: now.toISOString().slice(0, 10),
          proof_file_url: `/uploads/payment-proofs/BUKTI_${invNum}_dp_${dpAmount}_IDR_${now.toISOString().slice(0, 10).replace(/-/g, '')}_120000.pdf`,
          verified_by: INVOICE_USER,
          verified_at: now,
          verified_status: 'verified',
          created_at: now,
          updated_at: now
        });
      }
    }

    await queryInterface.bulkInsert('orders', orders).catch((e) => console.warn('orders:', e.message));
    await queryInterface.bulkInsert('order_items', orderItems).catch((e) => console.warn('order_items:', e.message));
    await queryInterface.bulkInsert('invoices', invoices).catch((e) => console.warn('invoices:', e.message));
    if (paymentProofs.length > 0) {
      await queryInterface.bulkInsert('payment_proofs', paymentProofs).catch((e) => console.warn('payment_proofs:', e.message));
    }
    console.log(`Seeder: 25 orders, 25 order_items, 25 invoices, ${paymentProofs.length} payment_proofs inserted.`);
  },

  async down(queryInterface, Sequelize) {
    const [orders] = await queryInterface.sequelize.query("SELECT id FROM orders WHERE order_number >= 'ORD-2026-00004' AND order_number <= 'ORD-2026-00028'");
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return;
    const [invoices] = await queryInterface.sequelize.query(
      `SELECT id FROM invoices WHERE order_id IN (${orderIds.map((id) => `'${id}'`).join(',')})`
    );
    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length > 0) {
      await queryInterface.bulkDelete('payment_proofs', { invoice_id: { [Op.in]: invoiceIds } }).catch(() => {});
    }
    await queryInterface.bulkDelete('invoices', { order_id: { [Op.in]: orderIds } }).catch(() => {});
    await queryInterface.bulkDelete('order_items', { order_id: { [Op.in]: orderIds } }).catch(() => {});
    await queryInterface.bulkDelete('orders', { id: { [Op.in]: orderIds } }).catch(() => {});
  }
};
