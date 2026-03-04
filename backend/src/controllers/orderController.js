const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Branch, Provinsi, OwnerProfile, Invoice, Notification, Product, VisaProgress, TicketProgress, HotelProgress, Refund, OwnerBalanceTransaction, InvoiceStatusHistory, OrderRevision, PaymentProof, PaymentReallocation } = require('../models');
const { getRulesForBranch } = require('./businessRuleController');
const { NOTIFICATION_TRIGGER, ORDER_ITEM_TYPE, ROOM_CAPACITY, VISA_PROGRESS_STATUS, TICKET_PROGRESS_STATUS, REFUND_STATUS, REFUND_SOURCE, BANDARA_TIKET_CODES, TICKET_TRIP_TYPES, BUS_TRIP_TYPES, BUSINESS_RULES, DP_PAYMENT_STATUS, INVOICE_STATUS, ORDER_STATUS } = require('../constants');
const { getEffectivePrice } = require('./productController');
const { checkAvailability } = require('../services/hotelAvailabilityService');
const { syncInvoiceFromOrder, createInvoiceForOrder } = require('./invoiceController');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const uploadConfig = require('../config/uploads');

const generateOrderNumber = () => {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 99999) + 1;
  return `ORD-${y}-${String(n).padStart(5, '0')}`;
};

async function logInvoiceStatusChange({ invoice_id, from_status, to_status, changed_by, reason, meta }) {
  try {
    await InvoiceStatusHistory.create({
      invoice_id,
      from_status: from_status ?? null,
      to_status,
      changed_at: new Date(),
      changed_by: changed_by || null,
      reason: reason || null,
      meta: meta && typeof meta === 'object' ? meta : {}
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('orderController logInvoiceStatusChange failed:', e?.message || e);
  }
}

/** Jumlah malam dari check_in s/d check_out (tanggal saja, tanpa waktu). Return 0 jika invalid. */
function getNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(String(checkIn).slice(0, 10));
  const b = new Date(String(checkOut).slice(0, 10));
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function pickDiffMeta(type, meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  if (type === ORDER_ITEM_TYPE.HOTEL) return { room_type: m.room_type ?? null, with_meal: m.with_meal ?? m.meal ?? false, check_in: m.check_in ?? null, check_out: m.check_out ?? null };
  if (type === ORDER_ITEM_TYPE.TICKET) return { bandara: m.bandara ?? null, trip_type: m.trip_type ?? null, departure_date: m.departure_date ?? null, return_date: m.return_date ?? null };
  if (type === ORDER_ITEM_TYPE.BUS) return { travel_date: m.travel_date ?? null, route_type: m.route_type ?? null, bus_type: m.bus_type ?? null, trip_type: m.trip_type ?? null };
  if (type === ORDER_ITEM_TYPE.VISA) return { travel_date: m.travel_date ?? null };
  return {};
}

function orderItemDiffKey(it) {
  const type = String(it.type || '');
  const pid = String(it.product_ref_id || it.product_id || '');
  const meta = it.meta && typeof it.meta === 'object' ? it.meta : {};
  if (type === ORDER_ITEM_TYPE.HOTEL) {
    const rt = String(meta.room_type || it.room_type || '');
    const wm = (meta.with_meal ?? meta.meal) ? '1' : '0';
    return `${type}:${pid}:${rt}:${wm}`;
  }
  if (type === ORDER_ITEM_TYPE.TICKET) {
    const bandara = String(meta.bandara || '');
    const trip = String(meta.trip_type || '');
    return `${type}:${pid}:${bandara}:${trip}`;
  }
  if (type === ORDER_ITEM_TYPE.BUS) {
    const route = String(meta.route_type || '');
    const busType = String(meta.bus_type || '');
    const trip = String(meta.trip_type || '');
    return `${type}:${pid}:${route}:${busType}:${trip}`;
  }
  return `${type}:${pid}`;
}

/** Konversi unit_price ke IDR untuk hitung total order. Harga asli (unit_price + unit_price_currency) disimpan tidak berubah. */
function unitPriceToIdr(amount, currency, rates) {
  const amt = parseFloat(amount) || 0;
  const cur = (currency || 'IDR').toUpperCase();
  const s2i = (rates && rates.SAR_TO_IDR != null) ? rates.SAR_TO_IDR : 4200;
  const u2i = (rates && rates.USD_TO_IDR != null) ? rates.USD_TO_IDR : 15500;
  if (cur === 'SAR') return amt * s2i;
  if (cur === 'USD') return amt * u2i;
  return amt;
}

function groupForDiff(items) {
  const map = new Map();
  for (const raw of items || []) {
    const key = orderItemDiffKey(raw);
    const prev = map.get(key);
    const qty = Math.max(0, Number(raw.quantity) || 0);
    const unit = Number.parseFloat(raw.unit_price) || 0;
    const base = prev || {
      type: raw.type,
      product_ref_id: raw.product_ref_id || raw.product_id,
      quantity: 0,
      unit_price: unit,
      meta: pickDiffMeta(raw.type, raw.meta)
    };
    base.quantity += qty;
    // Jika unit_price berbeda antar item dengan key sama, simpan 0 agar UI tidak misleading
    if (prev && Math.abs((prev.unit_price || 0) - unit) > 0.01) base.unit_price = 0;
    map.set(key, base);
  }
  return map;
}

function diffGrouped(beforeMap, afterMap) {
  const added = [];
  const removed = [];
  const updated = [];
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const k of keys) {
    const b = beforeMap.get(k);
    const a = afterMap.get(k);
    if (!b && a) added.push({ key: k, after: a });
    else if (b && !a) removed.push({ key: k, before: b });
    else if (b && a) {
      const changed = [];
      if (Math.abs((b.quantity || 0) - (a.quantity || 0)) > 0.0001) changed.push('quantity');
      if (Math.abs((b.unit_price || 0) - (a.unit_price || 0)) > 0.01) changed.push('unit_price');
      const bm = JSON.stringify(b.meta || {});
      const am = JSON.stringify(a.meta || {});
      if (bm !== am) changed.push('meta');
      if (changed.length) updated.push({ key: k, before: b, after: a, changed_fields: changed });
    }
  }
  return { added, removed, updated };
}

/**
 * GET /api/v1/orders
 */
const ALLOWED_SORT = ['created_at', 'total_amount', 'status'];

const list = asyncHandler(async (req, res) => {
  const { status, branch_id, owner_id, limit = 25, page = 1, sort_by, sort_order, date_from, date_to, invoice_number, provinsi_id, wilayah_id } = req.query;
  const where = {};
  if (status) where.status = status;
  if (branch_id) where.branch_id = branch_id;
  if (owner_id) where.owner_id = owner_id;
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  if (req.user.role === 'owner') where.owner_id = req.user.id;

  // Role invoice Saudi / super_admin / admin_pusat: lihat semua order (tanpa filter branch dari role)
  const isKoordinatorOrInvoiceKoordinator = ['invoice_koordinator'].includes(req.user.role);
  const seeAllOrdersByRole = ['super_admin', 'admin_pusat', 'invoice_saudi'].includes(req.user.role);
  let branchIdsWilayah = [];
  let effectiveWilayahId = req.user.wilayah_id;
  if (!seeAllOrdersByRole) {
    if (isKoordinatorOrInvoiceKoordinator) {
      if (!effectiveWilayahId && req.user.branch_id) {
        const branch = await Branch.findByPk(req.user.branch_id, {
          attributes: ['id'],
          include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }]
        });
        if (branch?.Provinsi?.wilayah_id) effectiveWilayahId = branch.Provinsi.wilayah_id;
      }
      if (effectiveWilayahId) {
        branchIdsWilayah = await getBranchIdsForWilayah(effectiveWilayahId);
        if (branchIdsWilayah.length > 0) {
          where.branch_id = branch_id ? (branchIdsWilayah.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIdsWilayah };
        } else if (req.user.branch_id) {
          where.branch_id = req.user.branch_id;
        }
      } else if (req.user.branch_id) {
        where.branch_id = req.user.branch_id;
      }
    } else if (req.user.branch_id) {
      where.branch_id = req.user.branch_id;
    }
  }

  if (provinsi_id || wilayah_id) {
    const branchWhere = { is_active: true };
    if (provinsi_id) branchWhere.provinsi_id = provinsi_id;
    const branchOpts = { where: branchWhere, attributes: ['id'] };
    if (wilayah_id) {
      branchOpts.include = [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }];
    }
    let branchIds = (await Branch.findAll(branchOpts)).map(r => r.id);
    if (isKoordinatorOrInvoiceKoordinator && branchIdsWilayah.length > 0 && branchIds.length > 0) {
      branchIds = branchIds.filter(id => branchIdsWilayah.includes(id));
    }
    if (branchIds.length > 0) {
      where.branch_id = branch_id ? (branchIds.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIds };
    } else {
      where.branch_id = 'none';
    }
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Acuan data: hanya order yang punya invoice; filter/tampil pakai nomor invoice saja
  const invoiceInclude = { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: true };
  if (invoice_number && String(invoice_number).trim()) {
    invoiceInclude.where = { invoice_number: { [Op.iLike]: `%${String(invoice_number).trim()}%` } };
  }
  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      invoiceInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: OrderItem, as: 'OrderItems' }
    ],
    order: [[sortCol, sortDir]],
    limit: lim,
    offset,
    distinct: true
  });
  const totalPages = Math.ceil(count / lim) || 1;
  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page: pg, limit: lim, totalPages }
  });
});

/** Cek apakah order items punya visa yang wajib hotel; jika ya, items harus ada hotel. */
async function visaRequiresHotel(items) {
  const visaProductIds = (items || [])
    .filter(i => i.type === ORDER_ITEM_TYPE.VISA && i.product_id)
    .map(i => i.product_id);
  if (visaProductIds.length === 0) return false;
  const products = await Product.findAll({
    where: { id: visaProductIds },
    attributes: ['id', 'meta'],
    raw: true
  });
  return products.some(p => (p.meta && p.meta.require_hotel === true));
}

/**
 * POST /api/v1/orders
 * Items: [{ product_id, type, quantity, unit_price (optional - resolved if not sent), room_type?, meal?, meta? }]
 * Validasi: visa wajib hotel dari product.meta.require_hotel; bus min pack penalty from business rules.
 */
const create = asyncHandler(async (req, res) => {
  const { items, branch_id, owner_id, notes, currency_rates_override } = req.body;
  const effectiveOwnerId = owner_id || req.user.id;
  // Gunakan branch_id dari body hanya jika benar-benar string non-kosong (body tanpa branch_id = undefined)
  const bodyBranchOk = typeof branch_id === 'string' && branch_id.trim() !== '';
  let effectiveBranchId = bodyBranchOk ? branch_id.trim() : (req.user.branch_id || null);
  const isInvoiceRole = ['invoice_koordinator', 'invoice_saudi'].includes(req.user.role);

  // Untuk owner: ambil assigned_branch_id dari OwnerProfile jika belum ada branch_id
  if (req.user.role === 'owner' && !effectiveBranchId) {
    try {
      const profile = await OwnerProfile.findOne({
        where: { user_id: req.user.id },
        attributes: ['assigned_branch_id'],
        raw: true
      });
      if (profile && profile.assigned_branch_id) {
        const assigned = profile.assigned_branch_id;
        const assignedStr = typeof assigned === 'string' ? assigned.trim() : String(assigned).trim();
        if (assignedStr && assignedStr !== 'null' && assignedStr !== 'undefined' && assignedStr.length >= 10) {
          effectiveBranchId = assignedStr;
        }
      }
    } catch (err) {
      console.error('Error fetching owner profile:', err);
    }
  }

  // Role invoice (koordinator/saudi): jika kirim owner_id tanpa branch_id, ambil cabang dari owner tersebut
  if (isInvoiceRole && effectiveOwnerId && !effectiveBranchId) {
    try {
      const profile = await OwnerProfile.findOne({
        where: { user_id: effectiveOwnerId },
        attributes: ['assigned_branch_id'],
        raw: true
      });
      if (profile && profile.assigned_branch_id) {
        const assignedStr = String(profile.assigned_branch_id).trim();
        if (assignedStr.length >= 10) effectiveBranchId = assignedStr;
      }
    } catch (err) {
      console.error('Error fetching owner profile for invoice role:', err);
    }
  }
  
  // Validasi final: pastikan branchId adalah UUID string yang valid sebelum digunakan
  const branchIdStr = effectiveBranchId != null && effectiveBranchId !== undefined 
    ? String(effectiveBranchId).trim() 
    : '';
  
  // Validasi: harus ada, bukan string kosong, bukan 'undefined'/'null', dan minimal panjang UUID
  const finalBranchId = branchIdStr && branchIdStr !== 'undefined' && branchIdStr !== 'null' && branchIdStr.length >= 10 
    ? branchIdStr 
    : null;
  
  if (!finalBranchId) {
    console.log('Order create failed - no branch_id:', {
      role: req.user.role,
      bodyBranchId: branch_id,
      userBranchId: req.user.branch_id,
      effectiveBranchId,
      branchIdStr
    });
    const msg = req.user.role === 'owner'
      ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
      : isInvoiceRole
        ? 'Owner yang dipilih belum memiliki cabang. Pilih owner lain atau hubungi admin untuk menetapkan cabang.'
        : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.';
    return res.status(400).json({ success: false, message: msg });
  }
  
  console.log('Order create - using branch_id:', finalBranchId, 'for user:', req.user.id, 'role:', req.user.role);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Item invoice wajib' });
  }

  const rules = await getRulesForBranch(finalBranchId);
  const hasHotel = items.some(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  const visaNeedsHotel = await visaRequiresHotel(items);
  if (visaNeedsHotel && !hasHotel) {
    return res.status(400).json({ success: false, message: 'Visa wajib bersama hotel' });
  }

  const canSetRatesCreate = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  let ratesForCreate = null;
  if (canSetRatesCreate && currency_rates_override && typeof currency_rates_override === 'object') {
    if (typeof currency_rates_override.SAR_TO_IDR === 'number' || typeof currency_rates_override.USD_TO_IDR === 'number') {
      ratesForCreate = {
        SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : 4200,
        USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : 15500
      };
    }
  }
  if (!ratesForCreate) {
    const cr = rules.currency_rates;
    const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
    if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
      ratesForCreate = {
        SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : 4200,
        USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : 15500
      };
    }
  }
  if (!ratesForCreate) ratesForCreate = { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };

  let subtotal = 0;
  let totalJamaah = 0;
  const orderItems = [];

  for (const it of items) {
    if (it.type === ORDER_ITEM_TYPE.TICKET) {
      const bandara = it.meta?.bandara;
      if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
        return res.status(400).json({ success: false, message: 'Item tiket wajib pilih bandara (BTH, CGK, SBY, atau UPG)' });
      }
      if (it.meta?.trip_type && !TICKET_TRIP_TYPES.includes(it.meta.trip_type)) {
        return res.status(400).json({ success: false, message: 'trip_type tiket harus one_way, return_only, atau round_trip' });
      }
      const tripType = it.meta?.trip_type || 'round_trip';
      if (tripType === 'round_trip' && (!it.meta?.departure_date || !it.meta?.return_date)) {
        return res.status(400).json({ success: false, message: 'Tiket pulang pergi wajib isi tanggal keberangkatan dan tanggal kepulangan' });
      }
      if (tripType === 'one_way' && !it.meta?.departure_date) {
        return res.status(400).json({ success: false, message: 'Tiket pergi saja wajib isi tanggal keberangkatan' });
      }
      if (tripType === 'return_only' && !it.meta?.return_date) {
        return res.status(400).json({ success: false, message: 'Tiket pulang saja wajib isi tanggal kepulangan' });
      }
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      if (it.meta?.trip_type && !BUS_TRIP_TYPES.includes(it.meta.trip_type)) {
        return res.status(400).json({ success: false, message: 'Trip type bus harus one_way, return_only, atau round_trip (pulang pergi)' });
      }
    }
    const qty = parseInt(it.quantity, 10) || 1;
    const itemCurrency = (it.currency && ['IDR', 'SAR', 'USD'].includes(String(it.currency).toUpperCase())) ? String(it.currency).toUpperCase() : 'IDR';
    let unitPrice = parseFloat(it.unit_price);
    if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) {
      const productId = it.product_id;
      if (!productId) return res.status(400).json({ success: false, message: 'product_id atau unit_price wajib per item' });
      unitPrice = await getEffectivePrice(productId, finalBranchId, effectiveOwnerId, it.meta || {}, itemCurrency);
      if (unitPrice == null) return res.status(400).json({ success: false, message: `Harga tidak ditemukan untuk product ${productId}` });
    }
    const unitPriceIdr = unitPriceToIdr(unitPrice, itemCurrency, ratesForCreate);
    const checkIn = it.check_in || it.meta?.check_in;
    const checkOut = it.check_out || it.meta?.check_out;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && it.product_id && it.room_type) {
      if (checkIn && checkOut) {
        const avail = await checkAvailability(it.product_id, it.room_type, checkIn, checkOut, qty, null);
        if (!avail.ok) return res.status(400).json({ success: false, message: avail.message || 'Kamar tidak tersedia untuk tanggal yang dipilih' });
      }
    }
    // Hotel & makan: hitung dari jumlah malam (check-in s/d check-out). Subtotal dalam IDR untuk total order.
    let st;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
      const nights = getNights(checkIn, checkOut);
      const multiplier = nights > 0 ? nights : 1;
      st = qty * unitPriceIdr * multiplier;
    } else {
      st = qty * unitPriceIdr;
    }
    subtotal += st;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && it.room_type && ROOM_CAPACITY[it.room_type] != null) {
      totalJamaah += qty * ROOM_CAPACITY[it.room_type];
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      totalJamaah += qty;
    }
    const meta = {
      room_type: it.room_type,
      meal: it.meal,
      ...(it.meta || {})
    };
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_in || it.meta?.check_in)) meta.check_in = it.check_in || it.meta.check_in;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_out || it.meta?.check_out)) meta.check_out = it.check_out || it.meta.check_out;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
      const nights = getNights(checkIn, checkOut);
      if (nights > 0) meta.nights = nights;
    }
    if (it.type === ORDER_ITEM_TYPE.BUS && !meta.trip_type) meta.trip_type = 'round_trip';
    orderItems.push({
      type: it.type,
      product_ref_id: it.product_id,
      product_ref_type: 'product',
      quantity: qty,
      unit_price: unitPrice,
      unit_price_currency: itemCurrency,
      subtotal: st,
      manifest_file_url: it.manifest_file_url || null,
      meta
    });
  }

  // Penalti bus: hanya jika order ada item bus; minimal 35 pack, jika kurang maka penalty per pack yang kurang
  const hasBusItems = orderItems.some((i) => i.type === ORDER_ITEM_TYPE.BUS);
  const totalBusPacks = orderItems.filter((i) => i.type === ORDER_ITEM_TYPE.BUS).reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const minPack = parseInt(rules.bus_min_pack, 10) || BUSINESS_RULES.BUS_MIN_PACK || 35;
  const penaltyPerPack = parseFloat(rules.bus_penalty_idr) || 500000;
  const penaltyAmount = hasBusItems && totalBusPacks < minPack ? Math.max(0, (minPack - totalBusPacks) * penaltyPerPack) : 0;

  // Final safety check sebelum create
  if (!finalBranchId || typeof finalBranchId !== 'string' || finalBranchId.length < 10) {
    return res.status(400).json({
      success: false,
      message: req.user.role === 'owner'
        ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
        : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.'
    });
  }

  const canSetRates = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  let ratesOverride = canSetRates && currency_rates_override && typeof currency_rates_override === 'object'
    ? {
        SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : null,
        USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : null
      }
    : null;
  if (!ratesOverride || (ratesOverride.SAR_TO_IDR == null && ratesOverride.USD_TO_IDR == null)) {
    const cr = rules.currency_rates;
    const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
    if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
      ratesOverride = {
        SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : null,
        USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : null
      };
    }
  }
  const ratesPayload = (ratesOverride && (ratesOverride.SAR_TO_IDR != null || ratesOverride.USD_TO_IDR != null))
    ? { currency_rates_override: ratesOverride }
    : {};

  let order;
  try {
    order = await Order.create({
      order_number: generateOrderNumber(),
      owner_id: effectiveOwnerId,
      branch_id: finalBranchId,
      total_jamaah: totalJamaah,
      subtotal,
      penalty_amount: penaltyAmount,
      total_amount: subtotal + penaltyAmount,
      status: 'draft',
      created_by: req.user.id,
      notes,
      ...ratesPayload
    });
  } catch (createErr) {
    console.error('Error creating order:', createErr);
    if (createErr.name === 'SequelizeValidationError' || createErr.name === 'SequelizeDatabaseError') {
      const field = createErr.errors?.[0]?.path || createErr.original?.constraint;
      if (field === 'branch_id' || (createErr.message && createErr.message.includes('branch_id'))) {
        return res.status(400).json({
          success: false,
          message: req.user.role === 'owner'
            ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
            : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.'
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat invoice: ' + (createErr.message || 'Unknown error')
    });
  }

  for (const it of orderItems) {
    await OrderItem.create({ ...it, order_id: order.id });
  }

  const saveAsDraft = req.body.save_as_draft === true || req.body.save_as_draft === 'true';
  if (!saveAsDraft) {
    const orderForInvoice = await Order.findByPk(order.id, {
      attributes: ['id', 'order_number', 'owner_id', 'branch_id', 'total_amount']
    });
    if (orderForInvoice) {
      try {
        const opts = {};
        if (req.body.dp_percentage != null) opts.dp_percentage = req.body.dp_percentage;
        if (req.body.dp_amount != null) opts.dp_amount = req.body.dp_amount;
        const inv = await createInvoiceForOrder(orderForInvoice, opts);
        if (inv) {
          console.log('Auto-created invoice', inv.invoice_number, 'for order', order.order_number);
        }
      } catch (invErr) {
        console.error('Auto-create invoice after order create failed:', invErr);
      }
    }
  }

  const full = await Order.findByPk(order.id, {
    include: [{ model: OrderItem, as: 'OrderItems' }]
  });
  res.status(201).json({ success: true, data: full });
});

/**
 * GET /api/v1/orders/:id
 */
const getById = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch' },
      {
        model: OrderItem,
        as: 'OrderItems',
        include: [
          { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false },
          { model: VisaProgress, as: 'VisaProgress', required: false },
          { model: TicketProgress, as: 'TicketProgress', required: false }
        ]
      },
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: false }
    ]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (req.user.role === 'owner' && order.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  res.json({ success: true, data: order });
});

/**
 * PATCH /api/v1/orders/:id
 * Update order (tambah/kurang/ubah item) - recalc totals. Invoice otomatis di-update bila ada.
 * Owner boleh ubah order sebelum dan setelah DP/lunas; sistem update invoice terbaru.
 */
const update = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'OrderItems' }] });
  if (!order) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  const canUpdate = ['invoice_koordinator', 'invoice_saudi'].includes(req.user.role) || (req.user.role === 'owner' && order.owner_id === req.user.id);
  if (!canUpdate) {
    return res.status(403).json({ success: false, message: 'Hanya owner (invoice sendiri) atau invoice koordinator/Saudi yang dapat mengubah order' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Invoice hanya bisa diubah saat draft/tentative/confirmed/processing' });
  }
  const { items, notes, currency_rates_override } = req.body;
  const canSetRates = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  const hasDpPayment = order.dp_payment_status === DP_PAYMENT_STATUS.PEMBAYARAN_DP;
  if (canSetRates && !hasDpPayment) {
    let ratesOverride = (currency_rates_override && typeof currency_rates_override === 'object')
      ? {
          SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : null,
          USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : null
        }
      : null;
    if ((!ratesOverride || (ratesOverride.SAR_TO_IDR == null && ratesOverride.USD_TO_IDR == null)) && order.branch_id) {
      const rules = await getRulesForBranch(order.branch_id);
      const cr = rules.currency_rates;
      const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
      if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
        ratesOverride = {
          SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : null,
          USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : null
        };
      }
    }
    const payload = (ratesOverride && (ratesOverride.SAR_TO_IDR != null || ratesOverride.USD_TO_IDR != null))
      ? { currency_rates_override: ratesOverride }
      : { currency_rates_override: null };
    await order.update(payload);
  }
  if (items && Array.isArray(items)) {
    const hasHotel = items.some(i => i.type === ORDER_ITEM_TYPE.HOTEL);
    const visaNeedsHotel = await visaRequiresHotel(items);
    if (visaNeedsHotel && !hasHotel) {
      return res.status(400).json({ success: false, message: 'Visa wajib bersama hotel' });
    }

    const totalsBefore = {
      subtotal: parseFloat(order.subtotal) || 0,
      penalty_amount: parseFloat(order.penalty_amount) || 0,
      total_amount: parseFloat(order.total_amount) || 0
    };
    const beforeItemsRaw = (order.OrderItems || []).map((oi) => ({
      type: oi.type,
      product_ref_id: oi.product_ref_id,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      meta: oi.meta
    }));
    const beforeMap = groupForDiff(beforeItemsRaw);
    const afterItemsRaw = [];

    let ratesForUpdate = null;
    const ov = order.currency_rates_override && typeof order.currency_rates_override === 'object' ? order.currency_rates_override : null;
    if (ov && (ov.SAR_TO_IDR != null || ov.USD_TO_IDR != null)) {
      ratesForUpdate = { SAR_TO_IDR: ov.SAR_TO_IDR ?? 4200, USD_TO_IDR: ov.USD_TO_IDR ?? 15500 };
    }
    if (!ratesForUpdate && order.branch_id) {
      const rulesUp = await getRulesForBranch(order.branch_id);
      const cr = rulesUp.currency_rates;
      const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
      if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
        ratesForUpdate = { SAR_TO_IDR: crObj.SAR_TO_IDR ?? 4200, USD_TO_IDR: crObj.USD_TO_IDR ?? 15500 };
      }
    }
    if (!ratesForUpdate) ratesForUpdate = { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };

    await OrderItem.destroy({ where: { order_id: order.id } });
    let subtotal = 0, totalJamaah = 0;
    for (const it of items) {
      if (it.type === ORDER_ITEM_TYPE.TICKET) {
        const bandara = it.meta?.bandara;
        if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
          return res.status(400).json({ success: false, message: 'Item tiket wajib pilih bandara (BTH, CGK, SBY, atau UPG)' });
        }
        if (it.meta?.trip_type && !TICKET_TRIP_TYPES.includes(it.meta.trip_type)) {
          return res.status(400).json({ success: false, message: 'trip_type tiket harus one_way, return_only, atau round_trip' });
        }
        const tripType = it.meta?.trip_type || 'round_trip';
        if (tripType === 'round_trip' && (!it.meta?.departure_date || !it.meta?.return_date)) {
          return res.status(400).json({ success: false, message: 'Tiket pulang pergi wajib isi tanggal keberangkatan dan tanggal kepulangan' });
        }
        if (tripType === 'one_way' && !it.meta?.departure_date) {
          return res.status(400).json({ success: false, message: 'Tiket pergi saja wajib isi tanggal keberangkatan' });
        }
        if (tripType === 'return_only' && !it.meta?.return_date) {
          return res.status(400).json({ success: false, message: 'Tiket pulang saja wajib isi tanggal kepulangan' });
        }
      }
      if (it.type === ORDER_ITEM_TYPE.BUS) {
        if (it.meta?.trip_type && !BUS_TRIP_TYPES.includes(it.meta.trip_type)) {
          return res.status(400).json({ success: false, message: 'Trip type bus harus one_way, return_only, atau round_trip (pulang pergi)' });
        }
      }
      const qty = parseInt(it.quantity, 10) || 1;
      const itemCurrency = (it.currency && ['IDR', 'SAR', 'USD'].includes(String(it.currency).toUpperCase())) ? String(it.currency).toUpperCase() : 'IDR';
      let unitPrice = parseFloat(it.unit_price);
      if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) {
        unitPrice = await getEffectivePrice(it.product_id, order.branch_id, order.owner_id, it.meta || {}, itemCurrency) || 0;
      }
      const unitPriceIdr = unitPriceToIdr(unitPrice || 0, itemCurrency, ratesForUpdate);
      const checkIn = it.check_in || it.meta?.check_in;
      const checkOut = it.check_out || it.meta?.check_out;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.product_id && it.room_type) {
        if (checkIn && checkOut) {
          const avail = await checkAvailability(it.product_id, it.room_type, checkIn, checkOut, qty, order.id);
          if (!avail.ok) return res.status(400).json({ success: false, message: avail.message || 'Kamar tidak tersedia untuk tanggal yang dipilih' });
        }
      }
      // Hotel & makan: hitung dari jumlah malam (check-in s/d check-out). Subtotal dalam IDR.
      let st;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
        const nights = getNights(checkIn, checkOut);
        const multiplier = nights > 0 ? nights : 1;
        st = qty * unitPriceIdr * multiplier;
      } else {
        st = qty * unitPriceIdr;
      }
      subtotal += st;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.room_type && ROOM_CAPACITY[it.room_type] != null) {
        totalJamaah += qty * ROOM_CAPACITY[it.room_type];
      }
      if (it.type === ORDER_ITEM_TYPE.BUS) {
        totalJamaah += qty;
      }
      const meta = { room_type: it.room_type, meal: it.meal, ...(it.meta || {}) };
      if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_in || it.meta?.check_in)) meta.check_in = it.check_in || it.meta.check_in;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_out || it.meta?.check_out)) meta.check_out = it.check_out || it.meta.check_out;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
        const nights = getNights(checkIn, checkOut);
        if (nights > 0) meta.nights = nights;
      }
      if (it.type === ORDER_ITEM_TYPE.BUS && !meta.trip_type) meta.trip_type = 'round_trip';
      afterItemsRaw.push({
        type: it.type,
        product_id: it.product_id,
        quantity: qty,
        unit_price: unitPrice || 0,
        currency: itemCurrency,
        meta
      });
      const itemRates = hasDpPayment && it.currency_rates_override && typeof it.currency_rates_override === 'object'
        ? {
            SAR_TO_IDR: typeof it.currency_rates_override.SAR_TO_IDR === 'number' ? it.currency_rates_override.SAR_TO_IDR : null,
            USD_TO_IDR: typeof it.currency_rates_override.USD_TO_IDR === 'number' ? it.currency_rates_override.USD_TO_IDR : null
          }
        : null;
      const itemRatesPayload = (itemRates && (itemRates.SAR_TO_IDR != null || itemRates.USD_TO_IDR != null)) ? { currency_rates_override: itemRates } : {};
      await OrderItem.create({
        order_id: order.id,
        type: it.type,
        product_ref_id: it.product_id,
        product_ref_type: it.product_ref_type || 'product',
        quantity: qty,
        unit_price: unitPrice || 0,
        unit_price_currency: itemCurrency,
        subtotal: st,
        manifest_file_url: it.manifest_file_url || null,
        meta,
        ...itemRatesPayload
      });
    }
    // Penalti bus: hanya jika order ada item bus; minimal 35 pack, jika kurang maka penalty per pack yang kurang
    const hasBusItemsUpdate = items.some((i) => i.type === ORDER_ITEM_TYPE.BUS);
    const totalBusPacks = items.filter((i) => i.type === ORDER_ITEM_TYPE.BUS).reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
    const rulesUpdate = await getRulesForBranch(order.branch_id);
    const minPackUpdate = parseInt(rulesUpdate.bus_min_pack, 10) || BUSINESS_RULES.BUS_MIN_PACK || 35;
    const penaltyPerPackUpdate = parseFloat(rulesUpdate.bus_penalty_idr) || 500000;
    const penaltyAmountUpdate = hasBusItemsUpdate && totalBusPacks < minPackUpdate ? Math.max(0, (minPackUpdate - totalBusPacks) * penaltyPerPackUpdate) : 0;
    await order.update({
      subtotal,
      total_jamaah: totalJamaah,
      penalty_amount: penaltyAmountUpdate,
      total_amount: subtotal + penaltyAmountUpdate
    });
    const orderReloaded = await Order.findByPk(order.id, { attributes: ['id', 'total_amount', 'subtotal', 'penalty_amount'] });

    // Simpan revisi (diff) untuk audit perubahan order
    const afterMap = groupForDiff(afterItemsRaw.map((x) => ({ ...x, product_ref_id: x.product_id })));
    const diff = diffGrouped(beforeMap, afterMap);
    const hasChanges = (diff.added?.length || 0) + (diff.removed?.length || 0) + (diff.updated?.length || 0) > 0;

    let revision = null;
    const inv = await Invoice.findOne({ where: { order_id: order.id } });
    if (hasChanges) {
      const maxNo = await OrderRevision.max('revision_no', { where: { order_id: order.id } });
      const revisionNo = (Number.isFinite(maxNo) ? Number(maxNo) : 0) + 1;

      const productIds = [...new Set([
        ...Array.from(beforeMap.values()).map((v) => v.product_ref_id).filter(Boolean),
        ...Array.from(afterMap.values()).map((v) => v.product_ref_id).filter(Boolean)
      ])];
      const productRows = productIds.length ? await Product.findAll({ where: { id: productIds }, attributes: ['id', 'name'], raw: true }) : [];
      const productNameMap = new Map(productRows.map((p) => [p.id, p.name]));
      const attachNames = (obj) => {
        if (!obj) return obj;
        const pid = obj.product_ref_id;
        return { ...obj, product_name: productNameMap.get(pid) || null };
      };
      const diffWithNames = {
        added: (diff.added || []).map((x) => ({ ...x, after: attachNames(x.after) })),
        removed: (diff.removed || []).map((x) => ({ ...x, before: attachNames(x.before) })),
        updated: (diff.updated || []).map((x) => ({ ...x, before: attachNames(x.before), after: attachNames(x.after) }))
      };

      revision = await OrderRevision.create({
        order_id: order.id,
        invoice_id: inv ? inv.id : null,
        revision_no: revisionNo,
        changed_at: new Date(),
        changed_by: req.user.id,
        diff: diffWithNames,
        totals_before: totalsBefore,
        totals_after: { subtotal, penalty_amount: penaltyAmountUpdate, total_amount: subtotal + penaltyAmountUpdate }
      });
    }

    // Sinkronkan invoice & tandai “DP + Update Invoice” jika sudah ada pembayaran
    const paid = inv ? (parseFloat(inv.paid_amount) || 0) : 0;
    const shouldMarkUpdated = inv && paid > 0;
    await syncInvoiceFromOrder(orderReloaded || order, {
      changed_by: req.user.id,
      reason: hasChanges ? (shouldMarkUpdated ? 'order_updated_after_payment' : 'sync_from_order') : 'sync_from_order',
      order_updated_at: hasChanges ? new Date() : null,
      last_order_revision_id: revision ? revision.id : null,
      meta: revision ? { revision_id: revision.id, revision_no: revision.revision_no } : null
    });
  }
  if (notes !== undefined) await order.update({ notes });
  const full = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }] }]
  });
  res.json({ success: true, data: full });
});

/**
 * DELETE /api/v1/orders/:id
 * Batalkan order (soft: status = cancelled). Jika ada pembayaran, body wajib: action = 'to_balance' | 'refund' | 'allocate_to_order'.
 * - to_balance: seluruh pembayaran jadi saldo akun (untuk order baru atau alokasi ke tagihan).
 * - refund: permintaan refund; wajib bank_name, account_number. Opsional: refund_amount (default full). Jika partial: remainder_action = 'to_balance' | 'allocate_to_order', remainder_target_invoice_id jika allocate.
 * - allocate_to_order: pindahkan seluruh pembayaran ke invoice lain; wajib target_invoice_id.
 */
const destroy = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  const canDelete = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role) || (req.user.role === 'owner' && order.owner_id === req.user.id);
  if (!canDelete) {
    return res.status(403).json({ success: false, message: 'Hanya owner (invoice sendiri) atau tim invoice/admin yang dapat membatalkan order' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Invoice hanya bisa dibatalkan saat draft/tentative/confirmed/processing' });
  }

  const inv = await Invoice.findOne({ where: { order_id: order.id } });
  const paidAmount = inv ? parseFloat(inv.paid_amount) || 0 : 0;
  const action = req.body && ['to_balance', 'refund', 'allocate_to_order'].includes(req.body.action) ? req.body.action : (paidAmount > 0 ? null : null);
  const reason = req.body && req.body.reason ? String(req.body.reason).trim() || null : null;
  const bankName = req.body && req.body.bank_name ? String(req.body.bank_name).trim() || null : null;
  const accountNumber = req.body && req.body.account_number ? String(req.body.account_number).trim() || null : null;
  const accountHolderName = req.body && req.body.account_holder_name ? String(req.body.account_holder_name).trim() || null : null;
  let refundAmount = req.body && req.body.refund_amount != null ? parseFloat(req.body.refund_amount) : null;
  const remainderAction = req.body && (req.body.remainder_action === 'to_balance' || req.body.remainder_action === 'allocate_to_order') ? req.body.remainder_action : null;
  const remainderTargetInvoiceId = req.body && req.body.remainder_target_invoice_id ? String(req.body.remainder_target_invoice_id).trim() || null : null;
  const targetInvoiceId = req.body && req.body.target_invoice_id ? String(req.body.target_invoice_id).trim() || null : null;

  if (paidAmount > 0 && !action) {
    return res.status(400).json({ success: false, message: 'Ada pembayaran. Pilih: to_balance (jadikan saldo), refund (minta refund ke rekening), atau allocate_to_order (pindah ke invoice lain).' });
  }
  if (action === 'refund') {
    if (!bankName || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Untuk refund wajib isi bank_name dan account_number (rekening tujuan pengembalian).' });
    }
    if (refundAmount == null || isNaN(refundAmount) || refundAmount <= 0) refundAmount = paidAmount;
    if (refundAmount > paidAmount) refundAmount = paidAmount;
    const remainder = paidAmount - refundAmount;
    if (remainder > 0 && !remainderAction) {
      return res.status(400).json({ success: false, message: 'Refund sebagian: pilih sisa dana: remainder_action = to_balance (jadikan saldo) atau allocate_to_order (alokasi ke invoice lain). Jika allocate_to_order wajib isi remainder_target_invoice_id.' });
    }
    if (remainder > 0 && remainderAction === 'allocate_to_order' && !remainderTargetInvoiceId) {
      return res.status(400).json({ success: false, message: 'Sisa dana dialokasikan ke invoice lain: wajib isi remainder_target_invoice_id.' });
    }
  }
  if (action === 'allocate_to_order') {
    if (!targetInvoiceId) return res.status(400).json({ success: false, message: 'Untuk pindah ke order lain wajib isi target_invoice_id.' });
    const targetInv = await Invoice.findByPk(targetInvoiceId);
    if (!targetInv) return res.status(404).json({ success: false, message: 'Invoice tujuan tidak ditemukan' });
    if (targetInv.owner_id !== order.owner_id) return res.status(400).json({ success: false, message: 'Invoice tujuan harus milik owner yang sama' });
    const targetStatus = (targetInv.status || '').toLowerCase();
    if (targetStatus === 'canceled' || targetStatus === 'cancelled' || targetStatus === 'cancelled_refund') return res.status(400).json({ success: false, message: 'Invoice tujuan tidak boleh yang sudah dibatalkan' });
  }

  let refund = null;
  let balanceAdded = null;
  let reallocationAdded = null;

  if (inv && paidAmount > 0 && action === 'to_balance') {
    const profile = await OwnerProfile.findOne({ where: { user_id: order.owner_id } });
    if (profile) {
      const currentBalance = parseFloat(profile.balance) || 0;
      const newBalance = currentBalance + paidAmount;
      await profile.update({ balance: newBalance });
      await OwnerBalanceTransaction.create({
        owner_id: order.owner_id,
        amount: paidAmount,
        type: 'cancel_credit',
        reference_type: 'order',
        reference_id: order.id,
        notes: `Pembatalan order ${order.order_number}; invoice ${inv.invoice_number}. Saldo +${Number(paidAmount).toLocaleString('id-ID')}`
      });
      balanceAdded = { previous: currentBalance, new: newBalance };
    }
  } else if (inv && paidAmount > 0 && action === 'refund') {
    const remainder = paidAmount - refundAmount;
    if (remainder > 0 && remainderAction === 'to_balance') {
      const profile = await OwnerProfile.findOne({ where: { user_id: order.owner_id } });
      if (profile) {
        const currentBalance = parseFloat(profile.balance) || 0;
        const newBalance = currentBalance + remainder;
        await profile.update({ balance: newBalance });
        await OwnerBalanceTransaction.create({
          owner_id: order.owner_id,
          amount: remainder,
          type: 'cancel_credit',
          reference_type: 'order',
          reference_id: order.id,
          notes: `Pembatalan order ${order.order_number}; sisa setelah refund. Saldo +${Number(remainder).toLocaleString('id-ID')}`
        });
        balanceAdded = { previous: currentBalance, new: newBalance, amount: remainder };
      }
    } else if (remainder > 0 && remainderAction === 'allocate_to_order' && remainderTargetInvoiceId) {
      const targetInv = await Invoice.findByPk(remainderTargetInvoiceId);
      const remainderTargetStatus = (targetInv?.status || '').toLowerCase();
      if (targetInv && targetInv.owner_id === order.owner_id && remainderTargetStatus !== 'canceled' && remainderTargetStatus !== 'cancelled' && remainderTargetStatus !== 'cancelled_refund') {
        const targetPaid = parseFloat(targetInv.paid_amount) || 0;
        const targetTotal = parseFloat(targetInv.total_amount) || 0;
        const newTargetPaid = targetPaid + remainder;
        const newTargetRemaining = Math.max(0, targetTotal - newTargetPaid);
        let newTargetStatus = targetInv.status;
        if (newTargetRemaining <= 0) newTargetStatus = INVOICE_STATUS.PAID;
        else if (newTargetPaid >= (parseFloat(targetInv.dp_amount) || 0)) newTargetStatus = INVOICE_STATUS.PARTIAL_PAID;
        const receivedNote = `Menerima pemindahan Rp ${Number(remainder).toLocaleString('id-ID')} dari invoice ${inv.invoice_number} (pembatalan order).`;
        const targetNotes = [receivedNote, (targetInv.notes || '').trim()].filter(Boolean).join('\n');
        await targetInv.update({ paid_amount: newTargetPaid, remaining_amount: newTargetRemaining, status: newTargetStatus, notes: targetNotes });
        if (newTargetStatus === INVOICE_STATUS.PAID) {
          const targetOrder = await Order.findByPk(targetInv.order_id, { attributes: ['id', 'status'] });
          if (targetOrder && !['completed', 'cancelled'].includes(targetOrder.status)) {
            await targetOrder.update({ status: ORDER_STATUS.PROCESSING });
          }
        }
        await PaymentReallocation.create({
          source_invoice_id: inv.id,
          target_invoice_id: remainderTargetInvoiceId,
          amount: remainder,
          performed_by: req.user.id,
          notes: `Pembatalan order ${order.order_number}; sisa setelah refund dialokasikan ke invoice ${targetInv.invoice_number}`
        });
        reallocationAdded = { target_invoice_id: remainderTargetInvoiceId, target_invoice_number: targetInv.invoice_number, amount: remainder };
      }
    }
    await inv.update({ paid_amount: 0, remaining_amount: 0 });
    refund = await Refund.create({
      invoice_id: inv.id,
      order_id: order.id,
      owner_id: order.owner_id,
      amount: refundAmount,
      status: REFUND_STATUS.REQUESTED,
      source: REFUND_SOURCE.CANCEL,
      reason: reason || null,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
      requested_by: req.user.id
    });
  } else if (inv && paidAmount > 0 && action === 'allocate_to_order' && targetInvoiceId) {
    const targetInv = await Invoice.findByPk(targetInvoiceId);
    if (targetInv && targetInv.owner_id === order.owner_id) {
      const targetPaid = parseFloat(targetInv.paid_amount) || 0;
      const targetTotal = parseFloat(targetInv.total_amount) || 0;
      const newTargetPaid = targetPaid + paidAmount;
      const newTargetRemaining = Math.max(0, targetTotal - newTargetPaid);
      let newTargetStatus = targetInv.status;
      if (newTargetRemaining <= 0) newTargetStatus = INVOICE_STATUS.PAID;
      else if (newTargetPaid >= (parseFloat(targetInv.dp_amount) || 0)) newTargetStatus = INVOICE_STATUS.PARTIAL_PAID;
      const receivedNote = `Menerima pemindahan Rp ${Number(paidAmount).toLocaleString('id-ID')} dari invoice ${inv.invoice_number} (pembatalan order).`;
      const targetNotes = [receivedNote, (targetInv.notes || '').trim()].filter(Boolean).join('\n');
      await targetInv.update({ paid_amount: newTargetPaid, remaining_amount: newTargetRemaining, status: newTargetStatus, notes: targetNotes });
      if (newTargetStatus === INVOICE_STATUS.PAID) {
        const targetOrder = await Order.findByPk(targetInv.order_id, { attributes: ['id', 'status'] });
        if (targetOrder && !['completed', 'cancelled'].includes(targetOrder.status)) {
          await targetOrder.update({ status: ORDER_STATUS.PROCESSING });
        }
      }
      await PaymentReallocation.create({
        source_invoice_id: inv.id,
        target_invoice_id: targetInvoiceId,
        amount: paidAmount,
        performed_by: req.user.id,
        notes: `Pembatalan order ${order.order_number}; dana dialihkan ke invoice ${targetInv.invoice_number}`
      });
      reallocationAdded = { target_invoice_id: targetInvoiceId, target_invoice_number: targetInv.invoice_number, amount: paidAmount };
    }
    await inv.update({ paid_amount: 0, remaining_amount: 0 });
  }

  let cancellationHandlingNote = null;
  if (inv && paidAmount > 0 && action) {
    const fmt = (n) => Number(n).toLocaleString('id-ID');
    if (action === 'to_balance') {
      cancellationHandlingNote = `Dipindahkan ke saldo akun. Jumlah: Rp ${fmt(paidAmount)}`;
    } else if (action === 'refund') {
      if (reallocationAdded && reallocationAdded.target_invoice_number) {
        cancellationHandlingNote = `Sisa Rp ${fmt(reallocationAdded.amount)} dialihkan ke invoice ${reallocationAdded.target_invoice_number}.`;
      } else if (balanceAdded != null && balanceAdded.amount != null) {
        cancellationHandlingNote = `Sisa Rp ${fmt(balanceAdded.amount)} dipindahkan ke saldo akun.`;
      }
    } else if (action === 'allocate_to_order' && reallocationAdded) {
      cancellationHandlingNote = `Dipindahkan ke invoice ${reallocationAdded.target_invoice_number || 'lain'}. Jumlah: Rp ${fmt(reallocationAdded.amount)}`;
    }
  }

  await order.update({ status: ORDER_STATUS.CANCELLED });
  if (inv) {
    const newInvoiceStatus = paidAmount > 0 ? INVOICE_STATUS.CANCELLED_REFUND : INVOICE_STATUS.CANCELED;
    const invoiceUpdates = {
      status: newInvoiceStatus,
      ...(paidAmount > 0 ? { cancelled_refund_amount: paidAmount } : { cancelled_refund_amount: null }),
      ...(action === 'to_balance' ? { paid_amount: 0, remaining_amount: 0 } : {}),
      ...(action === 'refund' ? { paid_amount: 0, remaining_amount: 0 } : {}),
      ...(cancellationHandlingNote ? { cancellation_handling_note: cancellationHandlingNote } : {})
    };
    await inv.update(invoiceUpdates);
    await logInvoiceStatusChange({
      invoice_id: inv.id,
      from_status: inv.status,
      to_status: newInvoiceStatus,
      changed_by: req.user.id,
      reason: paidAmount > 0 ? 'canceled_with_payment' : 'canceled',
      meta: {
        action: action || null,
        refund_id: refund?.id || null,
        order_id: order.id,
        reallocation: reallocationAdded || null,
        ...(paidAmount > 0 ? { cancelled_refund_amount: paidAmount } : {})
      }
    });
    if (refund) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: req.user.id,
        reason: 'refund_requested',
        meta: { refund_id: refund.id, amount: refundAmount, bank_name: bankName, account_number: accountNumber }
      });
    } else if (balanceAdded != null) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: req.user.id,
        reason: 'to_balance',
        meta: { amount: balanceAdded.amount != null ? balanceAdded.amount : paidAmount }
      });
    } else if (reallocationAdded) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: req.user.id,
        reason: 'allocate_to_order',
        meta: reallocationAdded
      });
    }
  }

  let message = 'Invoice dibatalkan.';
  if (balanceAdded != null) {
    const amt = balanceAdded.amount != null ? balanceAdded.amount : paidAmount;
    message = `Invoice dibatalkan. Saldo akun +Rp ${Number(amt).toLocaleString('id-ID')}. Dapat digunakan untuk order baru atau alokasi ke tagihan.`;
  } else if (refund) {
    message = `Invoice dibatalkan. Permintaan refund Rp ${Number(refundAmount).toLocaleString('id-ID')} ke ${bankName} ${accountNumber} telah dicatat. Role accounting akan memproses.`;
    if (reallocationAdded) message += ` Sisa Rp ${Number(reallocationAdded.amount).toLocaleString('id-ID')} dialokasikan ke invoice lain.`;
    else if (balanceAdded != null) message += ` Sisa telah ditambahkan ke saldo akun.`;
  } else if (reallocationAdded) {
    message = `Invoice dibatalkan. Dana Rp ${Number(reallocationAdded.amount).toLocaleString('id-ID')} dialihkan ke invoice lain.`;
  }

  res.json({ success: true, message, data: { order, refund, balance_added: balanceAdded, reallocation: reallocationAdded } });
});

/**
 * POST /api/v1/orders/:id/send-result
 * Kirim notifikasi hasil order ke owner. Scope: koordinator (order wilayahnya).
 */
const sendOrderResult = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const { channel } = req.body || {};
  const order = await Order.findByPk(orderId, {
    include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });

  const role = req.user.role;
  let allowed = false;
  if (['invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'].includes(role) && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (branchIds.includes(order.branch_id)) allowed = true;
  }
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Invoice tidak dalam scope Anda' });
  }

  const notif = await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.ORDER_COMPLETED,
    title: 'Trip selesai',
    message: `Invoice ${order.order_number} telah selesai. Hasil dapat diunduh/dilihat di aplikasi.`,
    data: { order_id: order.id, order_number: order.order_number },
    channel_in_app: true,
    channel_email: channel === 'email' || channel === 'both',
    channel_whatsapp: channel === 'whatsapp' || channel === 'both'
  });
  const sendEmail = channel === 'email' || channel === 'both';
  if (sendEmail && order.User?.email) {
    const { sendOrderResultEmail } = require('../utils/emailService');
    const msg = `Order ${order.order_number} telah selesai. Hasil dapat diunduh/dilihat di aplikasi.`;
    sendOrderResultEmail(order.User.email, order.User.name, order.order_number, msg)
      .then((sent) => {
        if (sent && notif.id) return Notification.update({ email_sent_at: new Date() }, { where: { id: notif.id } });
      })
      .catch((err) => require('../config/logger').error('sendOrderResultEmail failed: ' + (err.message || String(err))));
  }

  res.json({ success: true, message: 'Notifikasi telah dikirim ke owner.', data: { order_id: order.id } });
});

const jamaahDataDir = uploadConfig.getDir(uploadConfig.SUBDIRS.JAMAAH_DATA);
const jamaahStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, jamaahDataDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const id6 = (req.params.itemId || '').toString().slice(-6);
    const raw = (path.extname(file.originalname || '').toLowerCase());
    const ext = (raw === '.xlsx' || raw === '.xls') ? raw : (raw === '.zip' ? '.zip' : '.zip');
    cb(null, `JAMAAH_${id6}_${date}_${time}${ext}`);
  }
});
const uploadJamaahFile = multer({ storage: jamaahStorage, limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * POST /api/v1/orders/:orderId/items/:itemId/jamaah-data
 * Owner atau Invoice: upload data jamaah (ZIP) atau kirim link Google Drive. Hanya untuk order item visa/tiket.
 */
const uploadJamaahData = [
  uploadJamaahFile.single('jamaah_file'),
  asyncHandler(async (req, res) => {
    const { orderId, itemId } = req.params;
    const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'OrderItems' }] });
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    const canUpload = (req.user.role === 'owner' && order.owner_id === req.user.id) ||
      ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
    if (!canUpload) return res.status(403).json({ success: false, message: 'Hanya owner atau tim invoice yang dapat mengupload data jamaah' });

    const item = order.OrderItems.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Order item tidak ditemukan' });
    if (item.type !== ORDER_ITEM_TYPE.VISA && item.type !== ORDER_ITEM_TYPE.TICKET && item.type !== ORDER_ITEM_TYPE.HOTEL) {
      return res.status(400).json({ success: false, message: 'Data jamaah hanya untuk item visa, tiket, atau hotel' });
    }

    const link = (req.body.jamaah_data_link != null ? String(req.body.jamaah_data_link).trim() : '') || null;
    const hasFile = !!req.file;
    if (!hasFile && !link) return res.status(400).json({ success: false, message: 'Upload file (ZIP / Excel untuk hotel) atau isi link Google Drive' });
    if (hasFile && link) return res.status(400).json({ success: false, message: 'Pilih salah satu: file atau link Google Drive' });

    let jamaahDataType = null;
    let jamaahDataValue = null;
    if (hasFile) {
      const finalName = uploadConfig.jamaahDataFilename(order.order_number, item.id, req.file.originalname);
      const newPath = path.join(jamaahDataDir, finalName);
      try { fs.renameSync(req.file.path, newPath); } catch (e) { /* keep temp name */ }
      jamaahDataType = 'file';
      jamaahDataValue = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.JAMAAH_DATA, finalName);
    } else {
      if (!/^https?:\/\//i.test(link)) return res.status(400).json({ success: false, message: 'Link Google Drive harus berupa URL yang valid' });
      jamaahDataType = 'link';
      jamaahDataValue = link;
    }

    await item.update({
      jamaah_data_type: jamaahDataType,
      jamaah_data_value: jamaahDataValue,
      jamaah_uploaded_at: new Date(),
      jamaah_uploaded_by: req.user.id
    });

    if (item.type === ORDER_ITEM_TYPE.VISA) {
      let prog = await VisaProgress.findOne({ where: { order_item_id: item.id } });
      if (!prog) {
        prog = await VisaProgress.create({
          order_item_id: item.id,
          status: VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED,
          notes: 'Data jamaah diupload oleh owner/invoice',
          updated_by: req.user.id
        });
      } else if (prog.status !== VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED && prog.status !== VISA_PROGRESS_STATUS.SUBMITTED) {
        await prog.update({ status: VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED, updated_by: req.user.id });
      }
    }
    if (item.type === ORDER_ITEM_TYPE.TICKET) {
      let prog = await TicketProgress.findOne({ where: { order_item_id: item.id } });
      if (!prog) {
        prog = await TicketProgress.create({
          order_item_id: item.id,
          status: TICKET_PROGRESS_STATUS.DATA_RECEIVED,
          notes: 'Data jamaah diupload oleh owner/invoice',
          updated_by: req.user.id
        });
      } else if (prog.status === TICKET_PROGRESS_STATUS.PENDING) {
        await prog.update({ status: TICKET_PROGRESS_STATUS.DATA_RECEIVED, updated_by: req.user.id });
      }
    }

    const updated = await OrderItem.findByPk(item.id, {
      include: [
        { model: VisaProgress, as: 'VisaProgress', required: false },
        { model: TicketProgress, as: 'TicketProgress', required: false },
        { model: HotelProgress, as: 'HotelProgress', required: false }
      ]
    });
    res.json({ success: true, data: updated, message: 'Data jamaah berhasil disimpan. Divisi visa/tiket/hotel dapat mengambil dokumen untuk proses penerbitan.' });
  })
];

module.exports = { list, create, getById, update, destroy, sendOrderResult, uploadJamaahData };
