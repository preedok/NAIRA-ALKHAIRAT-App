'use strict';

const { QueryTypes } = require('sequelize');

/**
 * Hapus tipe kamar hotel "single" dari sistem:
 * - Kolom: inventory & monthly price → double
 * - product_prices.meta.room_type
 * - products.meta (room_types, breakdown, grid bulanan, dll.) — merge kuota/harga single → double
 * - product_availability.meta
 * - order_items.meta (hotel)
 */

function mergeMonthlyBlocks(singleBlock, doubleBlock) {
  if (!singleBlock) return doubleBlock || null;
  if (!doubleBlock) return JSON.parse(JSON.stringify(singleBlock));
  const sm = singleBlock.months || [];
  const dm = (doubleBlock.months || []).map((x) => ({ ...x }));
  const byYm = new Map(dm.map((x) => [x.year_month, x]));
  for (const row of sm) {
    if (!byYm.has(row.year_month)) {
      byYm.set(row.year_month, { year_month: row.year_month, sar_room_per_night: row.sar_room_per_night ?? null });
    } else {
      const d = byYm.get(row.year_month);
      if ((d.sar_room_per_night == null || d.sar_room_per_night === '') && row.sar_room_per_night != null) {
        d.sar_room_per_night = row.sar_room_per_night;
      }
    }
  }
  return { ...doubleBlock, months: Array.from(byYm.values()).sort((a, b) => String(a.year_month).localeCompare(String(b.year_month))) };
}

function migrateHotelProductMeta(m) {
  if (!m || typeof m !== 'object') return m;
  const out = JSON.parse(JSON.stringify(m));
  if (out.room_type === 'single') out.room_type = 'double';
  if (Array.isArray(out.room_types)) {
    out.room_types = [...new Set(out.room_types.map((rt) => (rt === 'single' ? 'double' : rt)))];
  }
  if (out.room_types && typeof out.room_types === 'object' && !Array.isArray(out.room_types)) {
    const o = { ...out.room_types };
    if (Object.prototype.hasOwnProperty.call(o, 'single')) {
      o.double = (Number(o.double) || 0) + (Number(o.single) || 0);
      delete o.single;
    }
    out.room_types = o;
  }
  for (const key of ['room_breakdown', 'prices_by_room']) {
    if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      const obj = { ...out[key] };
      if (Object.prototype.hasOwnProperty.call(obj, 'single')) {
        const sv = obj.single;
        if (!Object.prototype.hasOwnProperty.call(obj, 'double')) {
          obj.double = sv;
        } else if (typeof obj.double === 'object' && typeof sv === 'object' && sv) {
          obj.double = { ...obj.double, ...sv, price: obj.double.price ?? sv.price };
        }
        delete obj.single;
      }
      out[key] = obj;
    }
  }
  if (out.global_room_inventory && typeof out.global_room_inventory === 'object') {
    const g = { ...out.global_room_inventory };
    if (Object.prototype.hasOwnProperty.call(g, 'single')) {
      g.double = (Number(g.double) || 0) + (Number(g.single) || 0);
      delete g.single;
    }
    out.global_room_inventory = g;
  }
  if (out.hotel_monthly_series && out.hotel_monthly_series.room_type === 'single') {
    out.hotel_monthly_series = { ...out.hotel_monthly_series, room_type: 'double' };
  }
  const brt = out.hotel_monthly_series_by_room_type?.by_room_type;
  if (brt && typeof brt === 'object') {
    const next = { ...brt };
    if (next.single) {
      next.double = mergeMonthlyBlocks(next.single, next.double);
      delete next.single;
    }
    out.hotel_monthly_series_by_room_type = { ...out.hotel_monthly_series_by_room_type, by_room_type: next };
  }
  return out;
}

function migrateAvailabilityMeta(m) {
  return migrateHotelProductMeta(m);
}

function migrateOrderItemMeta(m) {
  if (!m || typeof m !== 'object') return m;
  const out = JSON.parse(JSON.stringify(m));
  if (out.room_type === 'single') out.room_type = 'double';
  return out;
}

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(
      `UPDATE hotel_room_inventory SET room_type = 'double', updated_at = NOW() WHERE LOWER(TRIM(room_type)) = 'single'`
    );
    await sequelize.query(
      `UPDATE hotel_monthly_prices SET room_type = 'double', updated_at = NOW() WHERE LOWER(TRIM(room_type)) = 'single'`
    );
    await sequelize.query(`
      UPDATE product_prices
      SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{room_type}', '"double"', true), updated_at = NOW()
      WHERE meta->>'room_type' = 'single'
    `);

    const hotels = await sequelize.query(
      `SELECT id, meta FROM products WHERE type = 'hotel' AND meta IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    if (Array.isArray(hotels)) {
      for (const row of hotels) {
        let meta = row.meta;
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta);
          } catch {
            continue;
          }
        }
        const newMeta = migrateHotelProductMeta(meta);
        await sequelize.query(`UPDATE products SET meta = :meta::jsonb, updated_at = NOW() WHERE id = :id`, {
          replacements: { id: row.id, meta: JSON.stringify(newMeta) }
        });
      }
    }

    const pavRows = await sequelize.query(
      `SELECT id, meta FROM product_availability WHERE meta IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    if (Array.isArray(pavRows)) {
      for (const row of pavRows) {
        let meta = row.meta;
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta);
          } catch {
            continue;
          }
        }
        const newMeta = migrateAvailabilityMeta(meta);
        await sequelize.query(`UPDATE product_availability SET meta = :meta::jsonb, updated_at = NOW() WHERE id = :id`, {
          replacements: { id: row.id, meta: JSON.stringify(newMeta) }
        });
      }
    }

    const items = await sequelize.query(
      `SELECT id, meta FROM order_items WHERE type = 'hotel' AND meta IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    if (Array.isArray(items)) {
      for (const row of items) {
        let meta = row.meta;
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta);
          } catch {
            continue;
          }
        }
        const raw = JSON.stringify(meta);
        if (!raw.includes('single')) continue;
        const newMeta = migrateOrderItemMeta(meta);
        await sequelize.query(`UPDATE order_items SET meta = :meta::jsonb, updated_at = NOW() WHERE id = :id`, {
          replacements: { id: row.id, meta: JSON.stringify(newMeta) }
        });
      }
    }
  },

  async down() {
    // Data migration; tidak dikembalikan.
  }
};
