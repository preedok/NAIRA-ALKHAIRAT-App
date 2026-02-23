/**
 * Layanan dashboard terpadu per scope (branch/wilayah).
 * Dipakai oleh: Admin Koordinator (scope wilayah), Admin Cabang (scope 1 cabang).
 * Satu sumber kebenaran untuk rekapitulasi order, owner, invoice, hotel, visa, tiket, bus.
 */
const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  User,
  OwnerProfile,
  Invoice,
  HotelProgress,
  VisaProgress,
  TicketProgress,
  BusProgress
} = require('../models');
const { ORDER_ITEM_TYPE } = require('../constants');

/**
 * Rekap pekerjaan per tipe item (hotel, visa, ticket, bus) untuk scope branchIds.
 * @param {string[]} branchIds - Array branch ID (satu untuk admin cabang, banyak untuk koordinator)
 * @param {string} itemType - ORDER_ITEM_TYPE.HOTEL | VISA | TICKET | BUS
 * @param {Model} ProgressModel - HotelProgress | VisaProgress | TicketProgress | BusProgress
 * @param {string|null} statusField - Nama field status di progress (null untuk bus: pakai bus_ticket_status)
 */
async function getRoleRecap(branchIds, itemType, ProgressModel, statusField) {
  if (!branchIds || branchIds.length === 0) {
    return itemType === ORDER_ITEM_TYPE.BUS
      ? { total: 0, ticket_pending: 0, ticket_issued: 0, trip_pending: 0 }
      : { total: 0, by_status: {} };
  }

  const asName = ProgressModel.name;
  const orderIds = await OrderItem.findAll({
    where: { type: itemType },
    attributes: ['order_id'],
    raw: true
  }).then(rows => [...new Set(rows.map(r => r.order_id))]);

  const orderWhere = branchIds.length === 1
    ? { id: orderIds, branch_id: branchIds[0] }
    : { id: orderIds, branch_id: { [Op.in]: branchIds } };

  const orders = await Order.findAll({
    where: orderWhere,
    include: [{
      model: OrderItem,
      as: 'OrderItems',
      where: { type: itemType },
      required: true,
      include: [{ model: ProgressModel, as: asName, required: false }]
    }]
  });

  let total = 0;
  const byStatus = {};
  orders.forEach(o => {
    (o.OrderItems || []).forEach(item => {
      total += 1;
      const prog = item[asName];
      if (asName === 'BusProgress' && prog) {
        byStatus.bus_ticket_pending = (byStatus.bus_ticket_pending || 0) + (prog.bus_ticket_status === 'pending' ? 1 : 0);
        byStatus.bus_ticket_issued = (byStatus.bus_ticket_issued || 0) + (prog.bus_ticket_status === 'issued' ? 1 : 0);
      } else if (statusField && prog) {
        const s = prog[statusField] || 'pending';
        byStatus[s] = (byStatus[s] || 0) + 1;
      }
    });
  });

  if (itemType === ORDER_ITEM_TYPE.BUS) {
    return {
      total,
      ticket_pending: byStatus.bus_ticket_pending || 0,
      ticket_issued: byStatus.bus_ticket_issued || 0,
      trip_pending: total - (byStatus.bus_ticket_issued || 0)
    };
  }
  return { total, by_status: byStatus };
}

/**
 * Data dashboard lengkap untuk scope branchIds.
 * @param {string[]} branchIds - Satu atau banyak branch ID
 * @returns {Promise<{ orders, orders_recent, owners, recap_invoice, recap_hotel, recap_visa, recap_ticket, recap_bus }>}
 */
async function getDashboardData(branchIds) {
  if (!branchIds || branchIds.length === 0) {
    return {
      orders: { total: 0, by_status: {} },
      orders_recent: [],
      owners: { total: 0, list: [] },
      recap_invoice: { total: 0, by_status: {} },
      recap_hotel: { total: 0, by_status: {} },
      recap_visa: { total: 0, by_status: {} },
      recap_ticket: { total: 0, by_status: {} },
      recap_bus: { total: 0, ticket_pending: 0, ticket_issued: 0, trip_pending: 0 }
    };
  }

  const branchIdFilter = branchIds.length === 1
    ? branchIds[0]
    : { [Op.in]: branchIds };

  const [
    orderCounts,
    ordersRecent,
    ownersInScope,
    invoiceStats,
    hotelStats,
    visaStats,
    ticketStats,
    busStats
  ] = await Promise.all([
    Order.findAndCountAll({
      where: { branch_id: branchIdFilter },
      attributes: ['status'],
      raw: true
    }).then(r => {
      const byStatus = {};
      (r.rows || []).forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      return { total: r.count, by_status: byStatus };
    }),
    Order.findAll({
      where: { branch_id: branchIdFilter },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }],
      order: [['created_at', 'DESC']],
      limit: 10
    }),
    OwnerProfile.findAndCountAll({
      where: { assigned_branch_id: branchIdFilter },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] }]
    }).then(r => ({ total: r.count, list: r.rows })),
    Invoice.findAll({
      where: { branch_id: branchIdFilter },
      attributes: ['id', 'status'],
      raw: true
    }).then(rows => {
      const byStatus = {};
      rows.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
      return { total: rows.length, by_status: byStatus };
    }),
    getRoleRecap(branchIds, ORDER_ITEM_TYPE.HOTEL, HotelProgress, 'status'),
    getRoleRecap(branchIds, ORDER_ITEM_TYPE.VISA, VisaProgress, 'status'),
    getRoleRecap(branchIds, ORDER_ITEM_TYPE.TICKET, TicketProgress, 'status'),
    getRoleRecap(branchIds, ORDER_ITEM_TYPE.BUS, BusProgress, null)
  ]);

  return {
    orders: orderCounts,
    orders_recent: ordersRecent,
    owners: { total: ownersInScope.total, list: ownersInScope.list },
    recap_invoice: invoiceStats,
    recap_hotel: hotelStats,
    recap_visa: visaStats,
    recap_ticket: ticketStats,
    recap_bus: busStats || { total: 0, ticket_pending: 0, ticket_issued: 0, trip_pending: 0 }
  };
}

module.exports = {
  getDashboardData,
  getRoleRecap
};
