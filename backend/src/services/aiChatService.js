/**
 * AI Chat Service - Konteks dari DB, panggil LLM, parse order_draft dari respons.
 * Untuk role owner: jawab pertanyaan, nego harga, dan setelah sepakat isi form order.
 */
const { Op } = require('sequelize');
const { Product, ProductPrice, Order, Invoice, OwnerProfile, User, Branch } = require('../models');
const { getRulesForBranch } = require('../controllers/businessRuleController');
const { getEffectivePrice } = require('../controllers/productController');
const { ORDER_ITEM_TYPE } = require('../constants');

const ORDER_DRAFT_MARKER = '### ORDER_DRAFT';
const ORDER_DRAFT_END = '```';

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

  const contextText = `
Kurs saat ini: 1 SAR = ${sarToIdr} IDR, 1 USD = ${usdToIdr} IDR.

Pemilik: ${ownerUser?.company_name || ownerUser?.name || 'Owner'}.

Daftar produk aktif (WAJIB gunakan id persis seperti di bawah untuk product_id di ORDER_DRAFT):
${productLines}

Ringkasan owner: ${ownerOrders} order, ${ownerInvoicesCount} invoice.
Order terbaru: ${recentOrders.length ? recentOrders.map(o => o.order_number).join(', ') : '-'}.
Invoice terbaru (5):
${invoiceLines}

Alur yang harus kamu ikuti:
1. Jawab pertanyaan apa pun tentang produk, harga, invoice, order, jadwal, berdasarkan data di atas saja.
2. Untuk permintaan harga/penawaran: berikan harga dari daftar produk. Kamu boleh menawarkan nego (diskon dalam batas wajar, misalnya beberapa persen) dan sebutkan angka jelas (IDR/SAR/USD) sampai owner setuju.
3. Setelah harga disepakati, minta owner menyebutkan daftar pesanan lengkap: produk apa, jumlah, tanggal (check_in/check_out hotel, departure/return tiket, travel_date visa/bus).
4. Setelah owner memberikan daftar pesanan lengkap, kamu WAJIB mengeluarkan blok ORDER_DRAFT di akhir balasan (format JSON persis seperti di bawah), dengan product_id yang HARUS diambil dari daftar produk di atas. Jangan mengarang UUID.
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
1. JAWAB PERTANYAAN: Jawab apa pun tentang produk umroh/travel, harga, invoice, order, jadwal—HANYA dari data konteks di bawah. Jika tidak ada data, jawab jujur.
2. NEGOSIASI HARGA: Berikan penawaran dari daftar produk. Jika owner minta diskon atau nego:
   - Tawarkan nego dalam batas wajar (misalnya diskon 2–5%, atau bundling).
   - Sebutkan angka final yang disepakati dengan jelas (IDR, SAR, dan/atau USD).
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
- Semua product_id HARUS UUID yang ada di daftar produk konteks.`;
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
}

module.exports = {
  buildContextForOwner,
  buildSystemPrompt,
  parseOrderDraftFromResponse,
  stripOrderDraftFromReply,
  callChat,
  getOwnerBranchId
};
