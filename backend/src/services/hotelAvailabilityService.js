const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { HotelSeason, HotelRoomInventory } = require('../models');

/**
 * Cari musim yang aktif untuk tanggal tertentu (date antara start_date dan end_date inklusif).
 */
async function getSeasonForDate(productId, dateStr) {
  const season = await HotelSeason.findOne({
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
 * Ambil inventori kamar per room_type untuk suatu musim.
 * Returns { single: 10, double: 5, ... }
 */
async function getInventoryForSeason(seasonId) {
  const rows = await HotelRoomInventory.findAll({
    where: { season_id: seasonId },
    attributes: ['room_type', 'total_rooms']
  });
  const out = {};
  for (const r of rows) {
    out[r.room_type] = r.total_rooms || 0;
  }
  return out;
}

/**
 * Hitung kamar yang sudah dibooking per (product_id, room_type, date). Raw query.
 */
async function getBookedForDateRaw(seq, productId, roomType, dateStr) {
  const [rows] = await seq.query(`
    SELECT COALESCE(SUM(oi.quantity), 0)::int AS booked
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    WHERE oi.type = 'hotel'
      AND oi.product_ref_id = :productId
      AND oi.meta->>'room_type' = :roomType
      AND (oi.meta->>'check_in')::date <= :dateStr::date
      AND (oi.meta->>'check_out')::date > :dateStr::date
  `, {
    replacements: { productId, roomType, dateStr }
  });
  return (rows && rows[0] && rows[0].booked) ? parseInt(rows[0].booked, 10) : 0;
}

/**
 * Availability per tanggal untuk satu product (hotel) dalam range tanggal.
 * Returns { byDate: { '2025-03-01': { single: { total, booked, available }, ... } }, byRoomType: { single: minAvailableInRange } }.
 */
async function getAvailabilityByDateRange(productId, startDateStr, endDateStr) {
  const byDate = {};
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const roomTypesSeen = new Set();
  const seq = sequelize;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const season = await getSeasonForDate(productId, dateStr);
    if (!season) {
      byDate[dateStr] = { _noSeason: true };
      continue;
    }
    const inventory = await getInventoryForSeason(season.id);
    byDate[dateStr] = {};
    for (const [rt, total] of Object.entries(inventory)) {
      roomTypesSeen.add(rt);
      const booked = await getBookedForDateRaw(sequelize, productId, rt, dateStr);
      byDate[dateStr][rt] = { total, booked, available: Math.max(0, total - booked) };
    }
  }

  const byRoomType = {};
  for (const rt of roomTypesSeen) {
    let minAvail = Infinity;
    for (const day of Object.values(byDate)) {
      if (day._noSeason) continue;
      const a = day[rt]?.available;
      if (a != null && a < minAvail) minAvail = a;
    }
    byRoomType[rt] = minAvail === Infinity ? 0 : minAvail;
  }

  return { byDate, byRoomType };
}

/**
 * Cek apakah untuk (productId, roomType, checkIn, checkOut) masih ada availability jika kita book quantity kamar.
 * Exclude orderId when updating order (so we don't count current order's items).
 */
async function checkAvailability(productId, roomType, checkInStr, checkOutStr, quantity, excludeOrderId = null) {
  const start = new Date(checkInStr);
  const end = new Date(checkOutStr);
  end.setDate(end.getDate() - 1); // last night is check_out - 1 day

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const season = await getSeasonForDate(productId, dateStr);
    if (!season) return { ok: false, message: `Tanggal ${dateStr} tidak ada musim yang terdefinisi` };
    const inv = await HotelRoomInventory.findOne({ where: { season_id: season.id, room_type: roomType } });
    const total = inv ? inv.total_rooms : 0;
    let booked = await getBookedForDateRaw(sequelize, productId, roomType, dateStr);
    if (excludeOrderId) {
      const [exRows] = await sequelize.query(`
        SELECT COALESCE(SUM(oi.quantity), 0)::int AS q
        FROM order_items oi
        WHERE oi.order_id = :excludeOrderId AND oi.type = 'hotel'
          AND oi.product_ref_id = :productId AND oi.meta->>'room_type' = :roomType
          AND (oi.meta->>'check_in')::date <= :dateStr::date
          AND (oi.meta->>'check_out')::date > :dateStr::date
      `, { replacements: { excludeOrderId, productId, roomType, dateStr } });
      const sub = (exRows && exRows[0]) ? exRows[0].q : 0;
      booked -= sub;
    }
    const available = total - booked;
    if (available < quantity) {
      return { ok: false, message: `Tanggal ${dateStr}: tipe ${roomType} tersedia ${available} kamar, butuh ${quantity}` };
    }
  }
  return { ok: true };
}

module.exports = {
  getSeasonForDate,
  getInventoryForSeason,
  getBookedForDateRaw: (productId, roomType, dateStr) => getBookedForDateRaw(sequelize, productId, roomType, dateStr),
  getAvailabilityByDateRange,
  checkAvailability
};
