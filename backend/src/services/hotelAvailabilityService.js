const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { HotelSeason, HotelRoomInventory, ProductAvailability } = require('../models');

/**
 * Tanggal in/out per baris order_item: sama seperti menu Invoice (HotelProgress dulu, lalu meta).
 * Menghindari geser hari bila meta berisi timestamp ISO vs DATEONLY di progress.
 */
const SQL_ITEM_CHECK_IN_DATE = `COALESCE(
  hp.check_in_date,
  (NULLIF(substring(oi.meta->>'check_in' from '^[0-9]{4}-[0-9]{2}-[0-9]{2}'), ''))::date,
  (NULLIF(btrim(oi.meta->>'check_in'), ''))::date
)`;
const SQL_ITEM_CHECK_OUT_DATE = `COALESCE(
  hp.check_out_date,
  (NULLIF(substring(oi.meta->>'check_out' from '^[0-9]{4}-[0-9]{2}-[0-9]{2}'), ''))::date,
  (NULLIF(btrim(oi.meta->>'check_out'), ''))::date
)`;

/** Waktu “sekarang” kalender di WIB (satu sumber untuk batas checkout). */
const SQL_NOW_JAKARTA_DATE = `(now() AT TIME ZONE 'Asia/Jakarta')::date`;
const SQL_NOW_JAKARTA_TIME = `(now() AT TIME ZONE 'Asia/Jakarta')::time`;

/**
 * Kamar dihitung terpakai pada tanggal kalender dateStr jika:
 * - malam menginap: check_in <= dateStr < check_out (tanggal), ATAU
 * - tanggal checkout: masih sebelum jam 12:00 WIB di hari itu (setelah 12:00 kamar kembali available).
 * Untuk tanggal checkout di masa depan (lihat kalender bulan depan): dianggap terpakai penuh sampai hari H jam 12.
 */
const SQL_HOTEL_OCCUPIED_ON_CALENDAR_DATE = `(
  (
    ${SQL_ITEM_CHECK_IN_DATE} <= :dateStr::date
    AND ${SQL_ITEM_CHECK_OUT_DATE} > :dateStr::date
  )
  OR (
    ${SQL_ITEM_CHECK_OUT_DATE} = :dateStr::date
    AND (
      ${SQL_NOW_JAKARTA_DATE} < :dateStr::date
      OR (
        ${SQL_NOW_JAKARTA_DATE} = :dateStr::date
        AND ${SQL_NOW_JAKARTA_TIME} < TIME '12:00'
      )
    )
  )
)`;

const HOTEL_AVAILABILITY_MODES = ['global', 'per_season'];
const ROOM_TYPES_LIST = ['single', 'double', 'triple', 'quad', 'quint'];

/** Tanggal kalender YYYY-MM-DD + N hari (tanpa bug timezone Date.toISOString()). */
function addDaysYmd(ymd, deltaDays) {
  const parts = String(ymd).split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return ymd;
  const dt = new Date(y, mo - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function compareYmd(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Loop setiap tanggal dari startYmd sampai endYmd inklusif. */
function forEachDateInclusive(startYmd, endYmd, fn) {
  let cur = startYmd;
  while (compareYmd(cur, endYmd) <= 0) {
    fn(cur);
    cur = addDaysYmd(cur, 1);
  }
}

/** Sama seperti di atas; fn boleh async (untuk query DB per tanggal). */
async function forEachDateInclusiveAsync(startYmd, endYmd, fn) {
  let cur = startYmd;
  while (compareYmd(cur, endYmd) <= 0) {
    await fn(cur);
    cur = addDaysYmd(cur, 1);
  }
}

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
 * Musim untuk sel kalender: jika tanggal di luar semua musim (mis. 1 Apr sebelum musim mulai 2 Apr),
 * pakai musim terdekat agar baris tipe kamar tetap tampil (kuota sama seperti musim acuan).
 */
async function getSeasonForCalendarDay(productId, dateStr) {
  const direct = await getSeasonForDate(productId, dateStr);
  if (direct) return { season: direct, carried: false };
  const all = await HotelSeason.findAll({
    where: { product_id: productId },
    order: [['start_date', 'ASC']]
  });
  if (!all.length) return { season: null, carried: false };
  if (compareYmd(dateStr, all[0].start_date) < 0) return { season: all[0], carried: true };
  const last = all[all.length - 1];
  if (compareYmd(dateStr, last.end_date) > 0) return { season: last, carried: true };
  for (const s of all) {
    if (compareYmd(dateStr, s.start_date) < 0) return { season: s, carried: true };
  }
  return { season: last, carried: true };
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
    LEFT JOIN hotel_progress hp ON hp.order_item_id = oi.id
    WHERE oi.type = 'hotel'
      AND oi.product_ref_id = :productId
      AND oi.meta->>'room_type' = :roomType
      AND ${SQL_HOTEL_OCCUPIED_ON_CALENDAR_DATE}
  `, {
    replacements: { productId, roomType, dateStr }
  });
  return (rows && rows[0] && rows[0].booked) ? parseInt(rows[0].booked, 10) : 0;
}

/** Kapasitas jamaah per tipe kamar: single=1, double=2, triple=3, quad=4, quint=5 */
const ROOM_TYPE_JAMAAH = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };

const DEFAULT_HOTEL_CHECK_IN_TIME = '16:00';
const DEFAULT_HOTEL_CHECK_OUT_TIME = '12:00';

function ymdFromMetaDate(val) {
  if (val == null || val === '') return null;
  const m = String(val).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Nilai DATE / string dari PG / Sequelize → YYYY-MM-DD (pakai UTC untuk objek Date). */
function ymdFromDbDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const mo = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return ymdFromMetaDate(String(val));
}

function normalizeHotelTime(t, fallback) {
  const s = (t != null && String(t).trim() !== '') ? String(t).trim() : '';
  if (!s) return fallback;
  const head = s.slice(0, 8);
  const parts = head.split(':');
  if (parts.length < 2) return fallback;
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseOrderItemMeta(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Daftar booking per tanggal untuk satu hotel: per order (owner, total jamaah, breakdown per room_type).
 * + stay_check_in, stay_check_out (YYYY-MM-DD), check_in_time, check_out_time (HH:MM) untuk penanda kalender.
 */
async function getBookingsForDate(productId, dateStr) {
  const [rows] = await sequelize.query(`
    SELECT o.id AS order_id, o.owner_id,
      u.name AS owner_name,
      oi.meta->>'room_type' AS room_type,
      COALESCE(oi.quantity, 0)::int AS qty,
      oi.meta AS meta_json,
      hp.check_in_date AS hp_check_in_date,
      hp.check_out_date AS hp_check_out_date,
      hp.check_in_time AS hp_check_in_time,
      hp.check_out_time AS hp_check_out_time
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    INNER JOIN users u ON u.id = o.owner_id
    LEFT JOIN hotel_progress hp ON hp.order_item_id = oi.id
    WHERE oi.type = 'hotel'
      AND oi.product_ref_id = :productId
      AND ${SQL_HOTEL_OCCUPIED_ON_CALENDAR_DATE}
  `, {
    replacements: { productId, dateStr }
  });

  const byOrder = new Map();
  for (const r of rows || []) {
    const key = r.order_id;
    const meta = parseOrderItemMeta(r.meta_json);
    const ciYmd = ymdFromDbDate(r.hp_check_in_date) || ymdFromMetaDate(meta.check_in);
    const coYmd = ymdFromDbDate(r.hp_check_out_date) || ymdFromMetaDate(meta.check_out);
    const cit = normalizeHotelTime(r.hp_check_in_time || meta.check_in_time, DEFAULT_HOTEL_CHECK_IN_TIME);
    const cot = normalizeHotelTime(r.hp_check_out_time || meta.check_out_time, DEFAULT_HOTEL_CHECK_OUT_TIME);

    if (!byOrder.has(key)) {
      byOrder.set(key, {
        order_id: r.order_id,
        owner_id: r.owner_id,
        owner_name: r.owner_name || '',
        total_jamaah: 0,
        by_room_type: {},
        stay_check_in: ciYmd,
        stay_check_out: coYmd,
        check_in_time: cit,
        check_out_time: cot
      });
    } else {
      const entry = byOrder.get(key);
      if (ciYmd) {
        if (!entry.stay_check_in || ciYmd < entry.stay_check_in) {
          entry.stay_check_in = ciYmd;
          entry.check_in_time = cit;
        }
      }
      if (coYmd) {
        if (!entry.stay_check_out || coYmd > entry.stay_check_out) {
          entry.stay_check_out = coYmd;
          entry.check_out_time = cot;
        }
      }
    }
    const entry = byOrder.get(key);
    const rt = (r.room_type || 'quad').toLowerCase();
    const qty = parseInt(r.qty, 10) || 0;
    const jamaahPerRoom = ROOM_TYPE_JAMAAH[rt] != null ? ROOM_TYPE_JAMAAH[rt] : 4;
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
  const roomTypesSeen = new Set();

  await forEachDateInclusiveAsync(startDateStr, endDateStr, async (dateStr) => {
    let inventory = {};
    let seasonId = null;
    let seasonName = null;

    if (config.mode === 'global') {
      inventory = config.global_room_inventory;
      seasonName = 'Semua bulan';
    } else {
      const { season, carried } = await getSeasonForCalendarDay(productId, dateStr);
      if (!season) {
        byDate[dateStr] = { _noSeason: true };
        return;
      }
      seasonId = season.id;
      seasonName = carried ? `${season.name} *` : season.name;
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
  });

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

  return { availability_mode: config.mode, byDate, byRoomType };
}

/**
 * Availability per tanggal untuk satu product (hotel) dalam range tanggal.
 * Mengikuti pilihan: mode 'global' = Semua jumlah kamar (satu set untuk setiap tanggal),
 * mode 'per_season' = kuota per musim. Frontend bisa pakai availability_mode untuk label.
 */
async function getAvailabilityByDateRange(productId, startDateStr, endDateStr) {
  const config = await getHotelAvailabilityConfig(productId);
  const byDate = {};
  const roomTypesSeen = new Set();

  await forEachDateInclusiveAsync(startDateStr, endDateStr, async (dateStr) => {
    let inventory = {};
    let seasonId = null;
    let seasonName = '';

    if (config.mode === 'global') {
      inventory = config.global_room_inventory;
      seasonName = 'Semua bulan';
    } else {
      const { season, carried } = await getSeasonForCalendarDay(productId, dateStr);
      if (!season) {
        byDate[dateStr] = { _noSeason: true };
        return;
      }
      seasonId = season.id;
      seasonName = carried ? `${season.name || ''} *` : (season.name || '');
      inventory = await getInventoryForSeason(season.id);
    }

    byDate[dateStr] = { seasonId, seasonName };
    for (const [rt, total] of Object.entries(inventory)) {
      roomTypesSeen.add(rt);
      const booked = await getBookedForDateRaw(sequelize, productId, rt, dateStr);
      byDate[dateStr][rt] = { total, booked, available: Math.max(0, total - booked) };
    }
  });

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
  const lastNightYmd = addDaysYmd(checkOutStr, -1);
  if (compareYmd(checkInStr, lastNightYmd) > 0) {
    return { ok: true };
  }

  let cur = checkInStr;
  while (compareYmd(cur, lastNightYmd) <= 0) {
    const dateStr = cur;
    let total = 0;

    if (config.mode === 'global') {
      total = config.global_room_inventory[roomType] != null ? config.global_room_inventory[roomType] : 0;
    } else {
      const { season } = await getSeasonForCalendarDay(productId, dateStr);
      if (!season) return { ok: false, message: `Tanggal ${dateStr} tidak ada musim yang terdefinisi` };
      const inv = await HotelRoomInventory.findOne({ where: { season_id: season.id, room_type: roomType } });
      total = inv ? inv.total_rooms : 0;
    }

    let booked = await getBookedForDateRaw(sequelize, productId, roomType, dateStr);
    if (excludeOrderId) {
      const [exRows] = await sequelize.query(`
        SELECT COALESCE(SUM(oi.quantity), 0)::int AS q
        FROM order_items oi
        LEFT JOIN hotel_progress hp ON hp.order_item_id = oi.id
        WHERE oi.order_id = :excludeOrderId AND oi.type = 'hotel'
          AND oi.product_ref_id = :productId AND oi.meta->>'room_type' = :roomType
          AND ${SQL_HOTEL_OCCUPIED_ON_CALENDAR_DATE}
      `, { replacements: { excludeOrderId, productId, roomType, dateStr } });
      const sub = (exRows && exRows[0]) ? exRows[0].q : 0;
      booked -= sub;
    }
    const available = total - booked;
    if (available < quantity) {
      return { ok: false, message: `Tanggal ${dateStr}: tipe ${roomType} tersedia ${available} kamar, butuh ${quantity}` };
    }
    cur = addDaysYmd(cur, 1);
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
