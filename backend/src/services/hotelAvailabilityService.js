const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { HotelSeason, HotelRoomInventory, ProductAvailability } = require('../models');

const HOTEL_AVAILABILITY_MODES = ['global', 'per_season'];
const ROOM_TYPES_LIST = ['single', 'double', 'triple', 'quad', 'quint'];

/**
 * Ambil konfigurasi ketersediaan hotel: mode (global = satu set kamar untuk semua bulan, per_season = kuota per musim).
 * Ketika mode global, jumlah kamar diambil dari meta.room_types (sumber yang sama dengan Pengaturan Jumlah).
 */
async function getHotelAvailabilityConfig(productId) {
  const av = await ProductAvailability.findOne({
    where: { product_id: productId },
    attributes: ['meta']
  });
  const meta = av?.meta && typeof av.meta === 'object' ? av.meta : {};
  const mode = meta.availability_mode && HOTEL_AVAILABILITY_MODES.includes(meta.availability_mode)
    ? meta.availability_mode
    : 'per_season';
  const roomTypesMeta = meta.room_types && typeof meta.room_types === 'object' ? meta.room_types : {};
  const globalRaw = meta.global_room_inventory && typeof meta.global_room_inventory === 'object'
    ? meta.global_room_inventory
    : {};
  const global_room_inventory = {};
  for (const rt of ROOM_TYPES_LIST) {
    if (mode === 'global' && roomTypesMeta[rt] != null) {
      global_room_inventory[rt] = Math.max(0, parseInt(roomTypesMeta[rt], 10) || 0);
    } else if (globalRaw[rt] != null) {
      global_room_inventory[rt] = Math.max(0, parseInt(globalRaw[rt], 10) || 0);
    } else {
      global_room_inventory[rt] = 0;
    }
  }
  return { mode, global_room_inventory };
}

/**
 * Cari musim yang aktif untuk tanggal tertentu (date antara start_date dan end_date inklusif).
 * Tidak dipakai ketika availability_mode === 'global'.
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

/** Kapasitas jamaah per tipe kamar: single=1, double=2, triple=3, quad=4, quint=5 */
const ROOM_TYPE_JAMAAH = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };

/**
 * Daftar booking per tanggal untuk satu hotel: per order (owner, total jamaah, breakdown per room_type).
 * total_jamaah = jumlah kamar × kapasitas per tipe (mis. quint = 5 jamaah per kamar).
 * Returns [{ order_id, owner_id, owner_name, total_jamaah, by_room_type: { single: 2, double: 1, ... } }].
 */
async function getBookingsForDate(productId, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT o.id AS order_id, o.owner_id,
      u.name AS owner_name,
      oi.meta->>'room_type' AS room_type,
      COALESCE(SUM(oi.quantity), 0)::int AS qty
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    INNER JOIN users u ON u.id = o.owner_id
    WHERE oi.type = 'hotel'
      AND oi.product_ref_id = :productId
      AND (oi.meta->>'check_in')::date <= :dateStr::date
      AND (oi.meta->>'check_out')::date > :dateStr::date
    GROUP BY o.id, o.owner_id, u.name, oi.meta->>'room_type'
  `, {
    replacements: { productId, dateStr }
  });

  const byOrder = new Map();
  for (const r of rows || []) {
    const key = r.order_id;
    if (!byOrder.has(key)) {
      byOrder.set(key, {
        order_id: r.order_id,
        owner_id: r.owner_id,
        owner_name: r.owner_name || '',
        total_jamaah: 0,
        by_room_type: {}
      });
    }
    const entry = byOrder.get(key);
    const rt = (r.room_type || 'quad').toLowerCase();
    const qty = parseInt(r.qty, 10) || 0;
    const jamaahPerRoom = ROOM_TYPE_JAMAAH[rt] != null ? ROOM_TYPE_JAMAAH[rt] : 4; // default quad = 4
    entry.by_room_type[rt] = (entry.by_room_type[rt] || 0) + qty;
    entry.total_jamaah += qty * jamaahPerRoom;
  }
  return Array.from(byOrder.values());
}

/**
 * Kalender hotel lengkap: availability per tanggal + bookings (owner + jamaah per room type) + seasonId per date.
 * Jika availability_mode === 'global', setiap tanggal pakai global_room_inventory (open semua bulan).
 * Jika 'per_season', pakai musim + inventori per musim.
 */
async function getHotelCalendar(productId, startDateStr, endDateStr) {
  const config = await getHotelAvailabilityConfig(productId);
  const byDate = {};
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const roomTypesSeen = new Set();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    let inventory = {};
    let seasonId = null;
    let seasonName = null;

    if (config.mode === 'global') {
      inventory = config.global_room_inventory;
      seasonName = 'Semua bulan';
    } else {
      const season = await getSeasonForDate(productId, dateStr);
      if (!season) {
        byDate[dateStr] = { _noSeason: true };
        continue;
      }
      seasonId = season.id;
      seasonName = season.name;
      inventory = await getInventoryForSeason(season.id);
    }

    const roomTypes = {};
    for (const [rt, total] of Object.entries(inventory)) {
      roomTypesSeen.add(rt);
      const booked = await getBookedForDateRaw(sequelize, productId, rt, dateStr);
      roomTypes[rt] = { total, booked, available: Math.max(0, total - booked) };
    }
    const bookings = await getBookingsForDate(productId, dateStr);
    byDate[dateStr] = {
      seasonId,
      seasonName,
      roomTypes,
      bookings
    };
  }

  const byRoomType = {};
  for (const rt of roomTypesSeen) {
    let minAvail = Infinity;
    for (const day of Object.values(byDate)) {
      if (day._noSeason) continue;
      const a = day.roomTypes?.[rt]?.available;
      if (a != null && a < minAvail) minAvail = a;
    }
    byRoomType[rt] = minAvail === Infinity ? 0 : minAvail;
  }

  return { byDate, byRoomType };
}

/**
 * Availability per tanggal untuk satu product (hotel) dalam range tanggal.
 * Mengikuti pilihan: mode 'global' = Semua jumlah kamar (satu set untuk setiap tanggal),
 * mode 'per_season' = kuota per musim. Frontend bisa pakai availability_mode untuk label.
 */
async function getAvailabilityByDateRange(productId, startDateStr, endDateStr) {
  const config = await getHotelAvailabilityConfig(productId);
  const byDate = {};
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const roomTypesSeen = new Set();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    let inventory = {};
    let seasonId = null;
    let seasonName = '';

    if (config.mode === 'global') {
      inventory = config.global_room_inventory;
      seasonName = 'Semua bulan';
    } else {
      const season = await getSeasonForDate(productId, dateStr);
      if (!season) {
        byDate[dateStr] = { _noSeason: true };
        continue;
      }
      seasonId = season.id;
      seasonName = season.name || '';
      inventory = await getInventoryForSeason(season.id);
    }

    byDate[dateStr] = { seasonId, seasonName };
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

  return { availability_mode: config.mode, byDate, byRoomType };
}

/**
 * Cek apakah untuk (productId, roomType, checkIn, checkOut) masih ada availability jika kita book quantity kamar.
 * Exclude orderId when updating order (so we don't count current order's items).
 * Jika mode global: total dari global_room_inventory. Jika per_season: total dari musim.
 */
async function checkAvailability(productId, roomType, checkInStr, checkOutStr, quantity, excludeOrderId = null) {
  const config = await getHotelAvailabilityConfig(productId);
  const start = new Date(checkInStr);
  const end = new Date(checkOutStr);
  end.setDate(end.getDate() - 1); // last night is check_out - 1 day

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    let total = 0;

    if (config.mode === 'global') {
      total = config.global_room_inventory[roomType] != null ? config.global_room_inventory[roomType] : 0;
    } else {
      const season = await getSeasonForDate(productId, dateStr);
      if (!season) return { ok: false, message: `Tanggal ${dateStr} tidak ada musim yang terdefinisi` };
      const inv = await HotelRoomInventory.findOne({ where: { season_id: season.id, room_type: roomType } });
      total = inv ? inv.total_rooms : 0;
    }

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
  getHotelAvailabilityConfig,
  getSeasonForDate,
  getInventoryForSeason,
  getBookedForDateRaw: (productId, roomType, dateStr) => getBookedForDateRaw(sequelize, productId, roomType, dateStr),
  getBookingsForDate,
  getHotelCalendar,
  getAvailabilityByDateRange,
  checkAvailability
};
