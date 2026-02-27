const { ProductAvailability } = require('../models');
const sequelize = require('../config/sequelize');

/** Senin dari minggu yang berisi dateStr (YYYY-MM-DD). Return YYYY-MM-DD. */
function getWeekStart(dateStr) {
  const d = new Date(String(dateStr).slice(0, 10));
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Ambil kuota seat untuk (productId, bandara, dateStr) dari product_availability.meta.bandara_schedules.
 * Resolusi: day[dateStr] > week[weekKey] > month[monthKey] > default.
 */
async function getQuotaForDate(productId, bandara, dateStr) {
  const av = await ProductAvailability.findOne({
    where: { product_id: productId },
    attributes: ['meta']
  });
  if (!av?.meta?.bandara_schedules?.[bandara]) return 0;
  const s = av.meta.bandara_schedules[bandara];
  let slot = null;
  if (s.day && s.day[dateStr]) slot = s.day[dateStr];
  if (!slot && s.week) {
    const weekKey = getWeekStart(dateStr);
    if (weekKey && s.week[weekKey]) slot = s.week[weekKey];
  }
  if (!slot && s.month) {
    const monthKey = dateStr.slice(0, 7);
    if (s.month[monthKey]) slot = s.month[monthKey];
  }
  if (!slot && s.default) slot = s.default;
  return slot && typeof slot.seat_quota === 'number' ? Math.max(0, slot.seat_quota) : 0;
}

/**
 * Hitung tiket yang sudah dipesan untuk (productId, bandara, dateStr).
 * Order item tiket dengan meta.bandara = bandara dan meta.departure_date = dateStr.
 */
async function getTicketBookedForDate(productId, bandara, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT COALESCE(SUM(oi.quantity), 0)::int AS booked
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    WHERE oi.type = 'ticket'
      AND oi.product_ref_id = :productId
      AND oi.meta->>'bandara' = :bandara
      AND (oi.meta->>'departure_date')::date = :dateStr::date
  `, {
    replacements: { productId, bandara, dateStr }
  });
  return (rows && rows[0] && rows[0].booked) ? parseInt(rows[0].booked, 10) : 0;
}

/**
 * Daftar booking tiket per (productId, bandara, dateStr): per order (owner, quantity).
 */
async function getTicketBookingsForDate(productId, bandara, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT o.id AS order_id, o.owner_id,
      u.name AS owner_name,
      COALESCE(SUM(oi.quantity), 0)::int AS quantity
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    INNER JOIN users u ON u.id = o.owner_id
    WHERE oi.type = 'ticket'
      AND oi.product_ref_id = :productId
      AND oi.meta->>'bandara' = :bandara
      AND (oi.meta->>'departure_date')::date = :dateStr::date
    GROUP BY o.id, o.owner_id, u.name
  `, {
    replacements: { productId, bandara, dateStr }
  });
  return (rows || []).map(r => ({
    order_id: r.order_id,
    owner_id: r.owner_id,
    owner_name: r.owner_name || '',
    quantity: parseInt(r.quantity, 10) || 0
  }));
}

/**
 * Kalender tiket: per tanggal ada quota, booked, available, bookings (untuk productId + bandara).
 */
async function getTicketCalendar(productId, bandara, startDateStr, endDateStr) {
  const byDate = {};
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const quota = await getQuotaForDate(productId, bandara, dateStr);
    const booked = await getTicketBookedForDate(productId, bandara, dateStr);
    const available = Math.max(0, quota - booked);
    const bookings = await getTicketBookingsForDate(productId, bandara, dateStr);
    byDate[dateStr] = {
      quota,
      booked,
      available,
      bookings
    };
  }

  return { byDate };
}

module.exports = {
  getWeekStart,
  getQuotaForDate,
  getTicketBookedForDate,
  getTicketBookingsForDate,
  getTicketCalendar
};
