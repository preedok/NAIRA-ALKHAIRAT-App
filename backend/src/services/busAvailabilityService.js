const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { BusSeason, BusSeasonQuota } = require('../models');

/**
 * Cari musim bus yang aktif untuk tanggal tertentu.
 */
async function getSeasonForDate(productId, dateStr) {
  const season = await BusSeason.findOne({
    where: {
      product_id: productId,
      start_date: { [Op.lte]: dateStr },
      end_date: { [Op.gte]: dateStr }
    },
    order: [['start_date', 'ASC']]
  });
  return season;
}

/**
 * Ambil kuota untuk suatu musim (satu angka).
 */
async function getQuotaForSeason(seasonId) {
  const row = await BusSeasonQuota.findOne({
    where: { season_id: seasonId },
    attributes: ['quota']
  });
  return row ? (row.quota || 0) : 0;
}

/**
 * Hitung bus yang sudah dipesan untuk (product_id, date).
 * Order item bus dengan meta.travel_date = dateStr.
 */
async function getBusBookedForDate(productId, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT COALESCE(SUM(oi.quantity), 0)::int AS booked
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    WHERE oi.type = 'bus'
      AND oi.product_ref_id = :productId
      AND (oi.meta->>'travel_date')::date = :dateStr::date
  `, {
    replacements: { productId, dateStr }
  });
  return (rows && rows[0] && rows[0].booked) ? parseInt(rows[0].booked, 10) : 0;
}

/**
 * Daftar booking bus per tanggal: per order (owner, quantity).
 */
async function getBusBookingsForDate(productId, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT o.id AS order_id, o.owner_id,
      u.name AS owner_name,
      COALESCE(SUM(oi.quantity), 0)::int AS quantity
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    INNER JOIN users u ON u.id = o.owner_id
    WHERE oi.type = 'bus'
      AND oi.product_ref_id = :productId
      AND (oi.meta->>'travel_date')::date = :dateStr::date
    GROUP BY o.id, o.owner_id, u.name
  `, {
    replacements: { productId, dateStr }
  });
  return (rows || []).map(r => ({
    order_id: r.order_id,
    owner_id: r.owner_id,
    owner_name: r.owner_name || '',
    quantity: parseInt(r.quantity, 10) || 0
  }));
}

/**
 * Kalender bus: per tanggal ada seasonId, quota, booked, available, bookings.
 * productMeta: optional { default_quota?: number } dari product.meta; dipakai jika tidak ada musim.
 */
async function getBusCalendar(productId, startDateStr, endDateStr, productMeta = null) {
  const defaultQuota = productMeta && typeof productMeta.default_quota === 'number' && productMeta.default_quota >= 0
    ? Math.round(productMeta.default_quota)
    : null;
  const byDate = {};
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const season = await getSeasonForDate(productId, dateStr);
    if (!season) {
      const booked = await getBusBookedForDate(productId, dateStr);
      const quota = defaultQuota;
      const available = quota != null ? Math.max(0, quota - booked) : null;
      const bookings = await getBusBookingsForDate(productId, dateStr);
      byDate[dateStr] = {
        _noSeason: true,
        quota: quota ?? undefined,
        booked,
        available: available ?? undefined,
        bookings
      };
      continue;
    }
    const quota = await getQuotaForSeason(season.id);
    const booked = await getBusBookedForDate(productId, dateStr);
    const available = Math.max(0, quota - booked);
    const bookings = await getBusBookingsForDate(productId, dateStr);
    byDate[dateStr] = {
      seasonId: season.id,
      seasonName: season.name,
      quota,
      booked,
      available,
      bookings
    };
  }

  return { byDate };
}

module.exports = {
  getSeasonForDate,
  getQuotaForSeason,
  getBusBookedForDate,
  getBusBookingsForDate,
  getBusCalendar
};
