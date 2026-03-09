/**
 * AI Chat Service - Semua data dari database (produk, harga, order, invoice, kurs).
 * Tidak ada hardcode atau data dummy: konteks dibangun dari Product, Order, Invoice, OwnerProfile, business rules.
 * Untuk role owner: jawab pertanyaan dari data DB, nego harga, lalu keluarkan ORDER_DRAFT untuk isi form order otomatis.
 */
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Product, ProductPrice, Order, Invoice, OwnerProfile, User, Branch } = require('../models');
const { getRulesForBranch } = require('../controllers/businessRuleController');
const { getEffectivePrice } = require('../controllers/productController');
const { getAvailabilityByDateRange } = require('./hotelAvailabilityService');
const { ORDER_ITEM_TYPE } = require('../constants');

const ORDER_DRAFT_MARKER = '### ORDER_DRAFT';
const ORDER_DRAFT_END = '```';

/** Bulan Indonesia ke angka (1-12) */
const BULAN_IDS = {
  januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4,
  mei: 5, juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agt: 8, agustus: 8,
  september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11,
  desember: 12, des: 12
};

/**
 * Ekstrak rentang tanggal dari teks pertanyaan user (tanpa hardcode/dummy).
 * Mengenali: "10-15 Maret", "10 Maret - 15 Maret", "tanggal 20 Maret", "2025-03-10 s/d 2025-03-15", "15 April sampai 20 April", dll.
 * Returns { startStr: 'YYYY-MM-DD', endStr: 'YYYY-MM-DD' } atau null jika tidak ditemukan.
 */
function parseDateRangeFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase().trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  // ISO range: 2025-03-10 to 2025-03-15 atau 2025-03-10 s/d 2025-03-15
  const isoRange = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*(?:s\/d|sampai|-|to)\s*(\d{4})-(\d{1,2})-(\d{1,2})/i);
  if (isoRange) {
    const [, y1, m1, d1, y2, m2, d2] = isoRange.map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      return {
        startStr: `${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
        endStr: `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`
      };
    }
  }

  // Satu tanggal ISO: 2025-03-10
  const isoSingle = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoSingle) {
    const [, y, m, d] = isoSingle.map(Number);
    const d0 = new Date(y, m - 1, d);
    if (!isNaN(d0.getTime())) {
      const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { startStr: s, endStr: s };
    }
  }

  // Pola: "10-15 Maret" atau "10 - 15 Maret 2025" atau "10 s/d 15 Maret"
  const rangeBulan = t.match(/(\d{1,2})\s*(?:-|s\/d|sampai)\s*(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/);
  if (rangeBulan) {
    const [, d1, d2, bulanKey, yearPart] = rangeBulan;
    const bulan = BULAN_IDS[bulanKey.replace(/\s/g, '')];
    const year = yearPart ? parseInt(yearPart, 10) : currentYear;
    if (bulan) {
      const day1 = Math.min(31, Math.max(1, parseInt(d1, 10)));
      const day2 = Math.min(31, Math.max(1, parseInt(d2, 10)));
      const start = new Date(year, bulan - 1, day1);
      const end = new Date(year, bulan - 1, day2);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (start > end) [start, end] = [end, start];
        return {
          startStr: start.toISOString().slice(0, 10),
          endStr: end.toISOString().slice(0, 10)
        };
      }
    }
  }

  // Pola: "10 Maret - 15 Maret" atau "10 Maret 2025 s/d 15 Maret 2025"
  const twoDatesBulan = t.match(/(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?\s*(?:s\/d|sampai|-)\s*(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/);
  if (twoDatesBulan) {
    const [, d1, bln1, y1, d2, bln2, y2] = twoDatesBulan;
    const b1 = BULAN_IDS[bln1.replace(/\s/g, '')];
    const b2 = BULAN_IDS[bln2.replace(/\s/g, '')];
    const year1 = y1 ? parseInt(y1, 10) : currentYear;
    const year2 = y2 ? parseInt(y2, 10) : currentYear;
    if (b1 && b2) {
      const start = new Date(year1, b1 - 1, Math.min(31, Math.max(1, parseInt(d1, 10))));
      const end = new Date(year2, b2 - 1, Math.min(31, Math.max(1, parseInt(d2, 10))));
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        return {
          startStr: start.toISOString().slice(0, 10),
          endStr: end.toISOString().slice(0, 10)
        };
      }
    }
  }

  // Satu tanggal: "10 Maret" atau "tanggal 20 Maret 2025"
  const singleBulan = t.match(/(?:tanggal\s+)?(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/);
  if (singleBulan) {
    const [, d, bulanKey, yearPart] = singleBulan;
    const bulan = BULAN_IDS[bulanKey.replace(/\s/g, '')];
    const year = yearPart ? parseInt(yearPart, 10) : currentYear;
    if (bulan) {
      const day = Math.min(31, Math.max(1, parseInt(d, 10)));
      const date = new Date(year, bulan - 1, day);
      if (!isNaN(date.getTime())) {
        const s = date.toISOString().slice(0, 10);
        return { startStr: s, endStr: s };
      }
    }
  }

  // d/m atau d/m/yyyy: 10/3 atau 10/3/2025, range 10/3-15/3
  const dmRange = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:-|s\/d|sampai)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (dmRange) {
    const [, d1, m1, y1, d2, m2, y2] = dmRange;
    const year1 = y1 ? parseInt(y1, 10) : currentYear;
    const year2 = y2 ? parseInt(y2, 10) : currentYear;
    const start = new Date(year1, parseInt(m1, 10) - 1, Math.min(31, parseInt(d1, 10)));
    const end = new Date(year2, parseInt(m2, 10) - 1, Math.min(31, parseInt(d2, 10)));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      return {
        startStr: start.toISOString().slice(0, 10),
        endStr: end.toISOString().slice(0, 10)
      };
    }
  }

  return null;
}

/**
 * Ambil branch_id untuk owner (dari OwnerProfile).
 */
async function getOwnerBranchId(ownerId) {
  const profile = await OwnerProfile.findOne({
    where: { user_id: ownerId },
    attributes: ['assigned_branch_id'],
    raw: true
  });
  const bid = profile?.assigned_branch_id;
  return bid && String(bid).trim().length >= 10 ? bid : null;
}

/**
 * Bangun konteks teks untuk system prompt: produk (id, nama, tipe, harga perkiraan), kurs, ringkasan order/invoice owner.
 */
async function buildContextForOwner(ownerId) {
  const branchId = await getOwnerBranchId(ownerId);
  const rules = branchId ? await getRulesForBranch(branchId) : {};
  const cr = rules.currency_rates || {};
  const rates = typeof cr === 'object' ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return {}; } })() : {});
  // Kurs dari business rules (DB); fallback hanya jika rules kosong
  const sarToIdr = rates.SAR_TO_IDR != null ? Number(rates.SAR_TO_IDR) : 4200;
  const usdToIdr = rates.USD_TO_IDR != null ? Number(rates.USD_TO_IDR) : 15500;

  const products = await Product.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'code', 'type', 'meta'],
    order: [['type', 'ASC'], ['name', 'ASC']],
    raw: true
  });

  const productSummaries = [];
  const productLimit = 80;
  for (const p of products.slice(0, productLimit)) {
    let priceIdr = null;
    try {
      priceIdr = await getEffectivePrice(p.id, branchId, ownerId, {}, 'IDR');
    } catch (e) {
      // skip
    }
    const priceSar = priceIdr != null ? (priceIdr / sarToIdr).toFixed(2) : null;
    const priceUsd = priceIdr != null ? (priceIdr / usdToIdr).toFixed(2) : null;
    productSummaries.push({
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      price_idr: priceIdr,
      price_sar: priceSar,
      price_usd: priceUsd
    });
  }

  const ownerOrders = await Order.count({ where: { owner_id: ownerId } });
  const ownerInvoicesCount = await Invoice.count({ where: { owner_id: ownerId } });
  const recentOrders = await Order.findAll({
    where: { owner_id: ownerId },
    attributes: ['id', 'order_number', 'created_at'],
    order: [['created_at', 'DESC']],
    limit: 5,
    raw: true
  });
  const recentInvoices = await Invoice.findAll({
    where: { owner_id: ownerId },
    attributes: ['id', 'invoice_number', 'status', 'total_amount', 'remaining_amount'],
    order: [['created_at', 'DESC']],
    limit: 5,
    raw: true
  });
  const ownerUser = await User.findByPk(ownerId, { attributes: ['name', 'company_name'], raw: true });

  const productLines = productSummaries.map(ps => {
    const prices = [];
    if (ps.price_idr != null) prices.push(`${Math.round(ps.price_idr).toLocaleString('id-ID')} IDR`);
    if (ps.price_sar != null) prices.push(`${ps.price_sar} SAR`);
    if (ps.price_usd != null) prices.push(`${ps.price_usd} USD`);
    return `- ${ps.type} | id: ${ps.id} | ${ps.name} (${ps.code}) | ${prices.join(' / ') || 'harga sesuai permintaan'}`;
  }).join('\n');

  const invoiceLines = recentInvoices.length
    ? recentInvoices.map(inv => `  ${inv.invoice_number} | ${inv.status} | Total ${parseFloat(inv.total_amount || 0).toLocaleString('id-ID')} IDR | Sisa ${parseFloat(inv.remaining_amount || 0).toLocaleString('id-ID')} IDR`).join('\n')
    : '  (belum ada)';

  // Data booking hotel dari order (untuk jawab pertanyaan ketersediaan / kalender)
  const today = new Date();
  const startBooking = new Date(today);
  startBooking.setDate(startBooking.getDate() - 7);
  const endBooking = new Date(today);
  endBooking.setDate(endBooking.getDate() + 90);
  const startStr = startBooking.toISOString().slice(0, 10);
  const endStr = endBooking.toISOString().slice(0, 10);
  let hotelBookingLines = '  (belum ada)';
  try {
    const [bookingRows] = await sequelize.query(`
      SELECT p.name AS product_name, oi.meta->>'check_in' AS check_in, oi.meta->>'check_out' AS check_out, oi.meta->>'room_type' AS room_type, oi.quantity
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
      INNER JOIN products p ON p.id = oi.product_ref_id
      WHERE oi.type = 'hotel'
        AND (oi.meta->>'check_in')::date <= :endStr::date
        AND (oi.meta->>'check_out')::date >= :startStr::date
      ORDER BY (oi.meta->>'check_in')::date
      LIMIT 50
    `, { replacements: { startStr, endStr } });
    if (bookingRows && bookingRows.length > 0) {
      hotelBookingLines = bookingRows.map(r => {
        const rt = (r.room_type || 'quad').toLowerCase();
        return `  ${r.product_name} | ${r.check_in} s/d ${r.check_out} | ${rt} × ${r.quantity}`;
      }).join('\n');
    }
  } catch (e) {
    // ignore
  }

  // Ketersediaan kamar hotel dari KALENDER: 60 hari ke depan (inventori minus booking), semua produk hotel
  const hotelProducts = productSummaries.filter(p => p.type === 'hotel');
  const availStart = today.toISOString().slice(0, 10);
  const availEndDate = new Date(today);
  availEndDate.setDate(availEndDate.getDate() + 60);
  const availEnd = availEndDate.toISOString().slice(0, 10);
  const availabilityLines = [];
  for (const hp of hotelProducts) {
    try {
      const avail = await getAvailabilityByDateRange(hp.id, availStart, availEnd);
      const parts = [];
      if (avail.byRoomType && typeof avail.byRoomType === 'object') {
        for (const [rt, count] of Object.entries(avail.byRoomType)) {
          if (count != null && Number(count) > 0) parts.push(`${rt}: ${count}`);
        }
      }
      if (parts.length > 0) {
        availabilityLines.push(`  ${hp.name}: ${parts.join(', ')} kamar (minimal tersedia per hari dalam periode)`);
      } else {
        availabilityLines.push(`  ${hp.name}: (tidak ada musim/kalender untuk periode ini)`);
      }
    } catch (e) {
      availabilityLines.push(`  ${hp.name}: (data tidak tersedia)`);
    }
  }
  const hotelAvailabilityBlock = availabilityLines.length > 0 ? availabilityLines.join('\n') : '  (tidak ada data)';
  const calendarPeriodLabel = `Periode kalender ketersediaan: ${availStart} s/d ${availEnd} (60 hari dari hari ini).`;

  const contextText = `
Kurs saat ini: 1 SAR = ${sarToIdr} IDR, 1 USD = ${usdToIdr} IDR.

Pemilik: ${ownerUser?.company_name || ownerUser?.name || 'Owner'}.

Daftar produk aktif — setiap baris berisi harga dalam IDR, SAR, dan USD (WAJIB gunakan id persis untuk product_id di ORDER_DRAFT). Saat menyebut harga produk, tampilkan selalu ketiga mata uang: IDR, SAR, USD.
${productLines}

Ringkasan owner: ${ownerOrders} order, ${ownerInvoicesCount} invoice.
Order terbaru: ${recentOrders.length ? recentOrders.map(o => o.order_number).join(', ') : '-'}.
Invoice terbaru (5):
${invoiceLines}

${calendarPeriodLabel}

Booking hotel dari order (check_in s/d check_out, tipe kamar, qty) — daftar pesanan yang sudah ada; gunakan untuk jawab "ada pesanan di tanggal X" atau "siapa yang book hotel Y":
${hotelBookingLines}

Ketersediaan kamar hotel (dari KALENDER: inventori minus booking, 60 hari ke depan) — SUMBER JAWABAN "apakah hotel X tersedia tanggal A–B":
${hotelAvailabilityBlock}
Penjelasan: Angka di atas = minimal kamar kosong per tipe untuk setiap hari dalam periode. Jika hotel tercantum dengan angka (mis. quad: 5), artinya hotel TERSEEDIA untuk rentang tanggal dalam periode; "tidak ada booking" untuk suatu hotel di suatu tanggal justru berarti kamar masih kosong. Jawab "tersedia" jika hotel ada di daftar ketersediaan dengan angka > 0 untuk periode yang ditanya; jawab "tidak ada data" hanya jika hotel tidak ada di daftar atau tertulis "(tidak ada musim/kalender)".

Alur (semua data hanya dari database di atas):
1. Jawab pertanyaan hanya dari data di atas. Untuk "hotel X tanggal A–B": gunakan blok "Ketersediaan kamar hotel" sebagai sumber utama; jika hotel X ada dan punya angka kamar (quad/double dll), jawab "tersedia" dengan menyebut jumlah per tipe; jangan katakan "tidak tersedia karena tidak ada booking" — tidak ada booking = kamar kosong. Jika hotel tidak ada di daftar ketersediaan atau tertulis tidak ada musim, baru katakan tidak ada datanya.
2. Nego harga: gunakan harga dari daftar produk. Boleh tawarkan diskon wajar (misalnya 2–5%) dan sebutkan angka final (IDR/SAR/USD) sampai owner setuju.
3. Setelah sepakat, minta daftar pesanan lengkap: produk, jumlah, tanggal (check_in/check_out hotel, departure/return tiket, travel_date visa/bus).
4. Setelah daftar pesanan lengkap, keluarkan blok ORDER_DRAFT. product_id dan product_name WAJIB copy persis dari baris daftar produk di atas (satu per satu sesuai yang dipesan). Jangan mengarang UUID atau nama.
`;

  return {
    contextText,
    productSummaries,
    sarToIdr,
    usdToIdr,
    branchId
  };
}

/**
 * System prompt untuk asisten AI owner.
 * AI menjawab dari data DB, nego harga dengan pintar, lalu minta daftar order dan keluarkan ORDER_DRAFT untuk isi form.
 */
function buildSystemPrompt(contextText) {
  return `Kamu adalah asisten AI canggih Bintang Global Group (BGG) untuk partner/owner travel. Profesional, ramah, dan sangat membantu.

KEMAMPUAN:
1. JAWAB PERTANYAAN: Jawab apa pun tentang produk, harga, invoice, order, jadwal, dan ketersediaan hotel—HANYA dari data konteks di bawah. Konteks berisi: daftar produk, periode kalender (60 hari), booking hotel (pesanan yang sudah ada), dan KETERSEDIAAN KAMAR DARI KALENDER (inventori minus booking, per tipe kamar). Untuk "apakah hotel X tersedia tanggal A–B": baca dari blok "Ketersediaan kamar hotel"; jika hotel X tercantum dengan angka (quad: N, double: M dll), artinya hotel TERSEEDIA untuk periode tersebut—jangan jawab "tidak tersedia karena tidak ada booking" (tidak ada booking = kamar kosong). Hanya katakan "tidak ada data" jika hotel tidak ada di daftar ketersediaan atau tertulis "(tidak ada musim/kalender)".
2. NEGOSIASI HARGA: Berikan penawaran dari daftar produk. Jika owner minta diskon atau nego:
   - Tawarkan nego dalam batas wajar (misalnya diskon 2–5%, atau bundling).
   - WAJIB sebutkan harga dalam tiga mata uang: IDR, SAR, dan USD (jangan hanya IDR). Contoh: "Harga untuk [produk]: [X] IDR / [Y] SAR / [Z] USD."
   - Konfirmasi: "Kita sepakat di [angka] [mata uang] untuk [item]?"
3. SETELAH SEPAKAT: Minta owner menyebutkan daftar pesanan lengkap:
   - Produk apa saja, jumlah, dan tanggal (check-in/check-out hotel, departure/return tiket, travel_date visa/bus).
   - Contoh: "Silakan sebutkan: hotel berapa kamar, tipe apa, check-in/out; visa berapa orang, travel date; tiket dari bandara mana, tanggal berangkat/pulang; bus jenis apa, tanggal."
4. SETELAH DAFTAR PESANAN LENGKAP: Kamu WAJIB mengeluarkan blok ORDER_DRAFT di akhir balasan (format JSON persis di bawah) agar sistem bisa mengisi form order otomatis. Gunakan product_id persis dari daftar produk di konteks (copy UUID); jangan mengarang.

KONTEKS DATA (hanya gunakan ini):
${contextText}

FORMAT ORDER_DRAFT (wajib; tulis di akhir balasan ketika deal + daftar pesanan sudah lengkap):
${ORDER_DRAFT_MARKER}
\`\`\`json
{
  "items": [
    {
      "type": "hotel",
      "product_id": "uuid-dari-daftar-produk-hotel",
      "product_name": "Nama Hotel",
      "quantity": 2,
      "unit_price_idr": 5000000,
      "meta": {
        "check_in": "YYYY-MM-DD",
        "check_out": "YYYY-MM-DD",
        "room_type": "quad",
        "with_meal": true,
        "room_unit_price": 4000000,
        "meal_unit_price": 1000000
      }
    },
    {
      "type": "visa",
      "product_id": "uuid-dari-daftar-produk-visa",
      "product_name": "Nama Visa",
      "quantity": 10,
      "unit_price_idr": 2500000,
      "meta": { "travel_date": "YYYY-MM-DD" }
    },
    {
      "type": "ticket",
      "product_id": "uuid-dari-daftar-produk-tiket",
      "product_name": "Tiket Bandara",
      "quantity": 10,
      "unit_price_idr": 15000000,
      "meta": {
        "bandara": "CGK",
        "trip_type": "round_trip",
        "departure_date": "YYYY-MM-DD",
        "return_date": "YYYY-MM-DD"
      }
    },
    {
      "type": "bus",
      "product_id": "uuid-dari-daftar-produk-bus",
      "product_name": "Bus Saudi",
      "quantity": 1,
      "unit_price_idr": 35000000,
      "meta": {
        "route_type": "full_route",
        "bus_type": "besar",
        "trip_type": "round_trip",
        "travel_date": "YYYY-MM-DD"
      }
    }
  ]
}
\`\`\`

ATURAN ITEM:
- type: hotel | visa | ticket | bus | handling | package.
- Hotel: meta wajib check_in, check_out, room_type (single/double/triple/quad/quint), with_meal (boolean). Jika ada breakdown kamar+makan, isi room_unit_price dan meal_unit_price (IDR) di meta.
- Tiket: meta bandara (BTH/CGK/SBY/UPG), trip_type (one_way/return_only/round_trip), departure_date, return_date jika round_trip.
- Visa: meta travel_date.
- Bus: meta route_type, bus_type (besar/menengah_hiace/kecil), trip_type, travel_date.
- Semua product_id HARUS UUID yang ada di daftar produk konteks.

PENTING: Semua informasi (produk, harga, nama, kurs) HANYA dari data konteks di atas. Saat menyebutkan harga produk (apa pun konteksnya), selalu tampilkan IDR, SAR, dan USD. Jangan mengarang product_id, nama produk, atau angka harga. Jika owner menanyakan produk/harga yang tidak ada di daftar, katakan tidak ada datanya.`;
}

/**
 * Validasi order_draft: hanya item dengan product_id yang ada di daftar produk DB.
 * Nama produk dan tipe diambil dari data DB, bukan dari AI (menghindari data karangan).
 */
function validateOrderDraftAgainstDb(orderDraft, productSummaries) {
  if (!orderDraft || !Array.isArray(orderDraft.items) || !Array.isArray(productSummaries)) return null;
  const byId = new Map(productSummaries.map(p => [p.id, p]));
  const validItems = orderDraft.items
    .filter(item => item && byId.has(item.product_id))
    .map(item => {
      const fromDb = byId.get(item.product_id);
      const negotiatedPrice = Number(item.unit_price_idr);
      // Harga dari nego (obrolan); jika tidak ada atau 0, pakai harga dari DB
      const unit_price_idr = (negotiatedPrice > 0 && Number.isFinite(negotiatedPrice)) ? negotiatedPrice : (fromDb.price_idr != null ? Number(fromDb.price_idr) : 0);
      return {
        type: fromDb.type,
        product_id: fromDb.id,
        product_name: fromDb.name,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        unit_price_idr,
        meta: item.meta && typeof item.meta === 'object' ? item.meta : {}
      };
    });
  if (validItems.length === 0) return null;
  return { items: validItems };
}

/**
 * Parse blok ORDER_DRAFT dari teks respons. Mengembalikan objek { items } atau null.
 */
function parseOrderDraftFromResponse(text) {
  if (!text || typeof text !== 'string') return null;
  const idx = text.indexOf(ORDER_DRAFT_MARKER);
  if (idx === -1) return null;
  const afterMarker = text.slice(idx + ORDER_DRAFT_MARKER.length);
  const codeStart = afterMarker.indexOf('```');
  if (codeStart === -1) return null;
  const jsonStart = afterMarker.slice(codeStart + 3);
  const endIdx = jsonStart.indexOf(ORDER_DRAFT_END);
  const jsonStr = endIdx === -1 ? jsonStart.trim() : jsonStart.slice(0, endIdx).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Hapus blok ORDER_DRAFT dari teks agar tidak tampil sebagai pesan ke user (opsional).
 */
function stripOrderDraftFromReply(text) {
  if (!text || typeof text !== 'string') return text;
  const idx = text.indexOf(ORDER_DRAFT_MARKER);
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
}

/**
 * Panggil OpenAI Chat Completion. Mengembalikan { reply, order_draft? }.
 */
async function callChat(messages, systemPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || String(apiKey).trim() === '') {
    return {
      reply: 'AI belum dikonfigurasi. Silakan set OPENAI_API_KEY di lingkungan server. Untuk sementara, Anda bisa langsung membuat order dari menu Invoice → Buat Order.',
      order_draft: null
    };
  }

  const OpenAI = require('openai').default;
  const openai = new OpenAI({ apiKey: apiKey.trim() });

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2048
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const orderDraft = parseOrderDraftFromResponse(content);
    const reply = stripOrderDraftFromReply(content);

    return { reply: reply || 'Maaf, tidak ada respons.', order_draft: orderDraft };
  } catch (err) {
    const status = err?.status || err?.response?.status;
    const msg = err?.message || String(err);
    if (status === 429 || /quota|billing|exceeded|rate limit/i.test(msg)) {
      return {
        reply: 'Kuota penggunaan OpenAI saat ini habis atau melebihi batas. Silakan periksa billing dan paket di https://platform.openai.com/account/billing. Untuk sementara, Anda bisa membuat order langsung dari menu Invoice → Buat Order.',
        order_draft: null
      };
    }
    if (status === 401 || /invalid.*api.*key|authentication/i.test(msg)) {
      return {
        reply: 'API key OpenAI tidak valid atau kedaluwarsa. Silakan periksa OPENAI_API_KEY di pengaturan server.',
        order_draft: null
      };
    }
    throw err;
  }
}

module.exports = {
  buildContextForOwner,
  buildSystemPrompt,
  parseOrderDraftFromResponse,
  stripOrderDraftFromReply,
  validateOrderDraftAgainstDb,
  callChat,
  getOwnerBranchId
};
