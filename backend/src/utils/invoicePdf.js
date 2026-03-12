/**
 * Invoice PDF generator - layout modern, user-friendly, informasi lengkap
 * Termasuk: qty per item, harga satuan, subtotal, rincian pembayaran, jumlah pembayaran, dll.
 */
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/** Path logo dari assets */
function getLogoPath() {
  const candidates = [
    path.join(__dirname, '../../..', 'frontend', 'src', 'assets', 'logo.png'),
    path.join(process.cwd(), 'frontend', 'src', 'assets', 'logo.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Buffer logo dengan background putih dijadikan transparan (menggunakan sharp); untuk embed di PDF */
async function getLogoBufferTransparent(logoPath) {
  if (!logoPath || !fs.existsSync(logoPath)) return null;
  try {
    const sharp = require('sharp');
    const { data, info } = await sharp(logoPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels || 4;
    const len = data.length;
    for (let i = 0; i < len; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= 248 && g >= 248 && b >= 248 && i + 3 < len) data[i + 3] = 0;
    }
    return await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
  } catch (_) {
    return null;
  }
}

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
const formatDateShort = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const paymentTypeLabel = (t) => (t === 'dp' ? 'DP' : t === 'partial' ? 'Cicilan' : t === 'full' ? 'Lunas' : t || '-');
const verifiedStatusLabel = (s) => (s === 'verified' ? 'Diverifikasi' : s === 'rejected' ? 'Ditolak' : 'Menunggu');
const typeLabel = (t) => ({ hotel: 'Hotel', visa: 'Visa', ticket: 'Tiket', bus: 'Bus', handling: 'Handling', package: 'Paket' }[String(t).toLowerCase()] || t);
const mealStatusLabel = (s) => ({ pending: 'Menunggu', confirmed: 'Dikonfirmasi', completed: 'Selesai' }[String(s).toLowerCase()] || s || '-');
/** Label status progress hotel (sesuai pilihan divisi hotel: Progress → Penetapan room → Pemberian nomor room → Selesai) */
const hotelProgressStatusLabel = (s) => ({
  waiting_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Penetapan room',
  room_assigned: 'Pemberian nomor room',
  completed: 'Selesai'
}[String(s).toLowerCase()] || s || '-');
const roomTypeLabel = (r) => ({ single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' }[String(r).toLowerCase()] || r || '-');
/** Kapasitas orang per kamar per tipe (untuk hitung jumlah orang dari kamar) */
const ROOM_CAPACITY = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };
const tripTypeLabel = (tt) => ({ one_way: 'Pergi saja', return_only: 'Pulang saja', round_trip: 'Pulang pergi' }[String(tt || '')] || tt || '');
const busRouteLabel = (r) => ({ full_route: 'Full rute (Mekkah–Madinah)', bandara_makkah: 'Bandara–Mekkah', bandara_madinah: 'Bandara–Madinah', bandara_madinah_only: 'Bandara–Madinah saja', hotel_makkah_madinah: 'Hotel Mekkah–Madinah', hotel_madinah_makkah: 'Hotel Madinah–Mekkah' }[String(r || '')] || r || '');
const busTypeLabel = (b) => ({ besar: 'Bus besar', menengah_hiace: 'Hiace', kecil: 'Mobil kecil' }[String(b || '')] || b || '');

const STATUS_LABELS = {
  draft: 'Draft',
  tentative: 'Tagihan DP',
  partial_paid: 'Pembayaran DP',
  paid: 'Lunas',
  processing: 'Processing',
  completed: 'Completed',
  overdue: 'Overdue',
  canceled: 'Dibatalkan',
  cancelled: 'Dibatalkan',
  cancelled_refund: 'Dibatalkan Refund',
  refunded: 'Refund Dana',
  order_updated: 'Order Diupdate',
  overpaid: 'Kelebihan Bayar',
  overpaid_transferred: 'Pindahan (Sumber)',
  overpaid_received: 'Pindahan (Penerima)',
  refund_canceled: 'Refund Dibatalkan',
  overpaid_refund_pending: 'Sisa Pengembalian'
};

const CANCELLATION_TO_BALANCE_LABEL = 'Direfund ke saldo akun';
const REALLOCATION_OUT_LABEL = 'Dana dipindahkan ke invoice lain';
const REFUNDED_LABEL = 'Sudah direfund';
const REFUND_IN_PROCESS_LABEL = 'Refund diproses';

/**
 * Status efektif untuk tampilan (PDF/list): sama dengan frontend — prioritaskan refund/saldo/realloc + refund dalam proses.
 * @param {object} data - invoice data dengan Refunds (urut created_at DESC), cancellation_handling_note, ReallocationsOut
 * @returns {string}
 */
function getEffectiveStatusLabel(data) {
  const status = (data.status || '').toLowerCase();
  const note = (data.cancellation_handling_note || '').toLowerCase();
  const refunds = data.Refunds || [];
  const reallocOut = data.ReallocationsOut || [];

  const hasRefundCompleted = refunds.some((r) => (r.status || '').toLowerCase() === 'refunded');
  const latestRefund = refunds.length > 0 ? refunds[0] : null;
  const refundInProgress = !hasRefundCompleted && latestRefund && ['requested', 'approved'].includes((latestRefund.status || '').toLowerCase());
  const isRefundToBalance = (note.includes('saldo akun') || note.includes('dipindahkan ke saldo')) && !hasRefundCompleted;
  const hasNoteReallocOut = note.includes('dipindahkan ke invoice') || note.includes('dialihkan ke invoice') || note.includes('dialihkan ke ');
  const isReallocationOut = reallocOut.length > 0 && (['canceled', 'cancelled', 'cancelled_refund'].includes(status) || hasNoteReallocOut) && !hasRefundCompleted;

  if (hasRefundCompleted) return REFUNDED_LABEL;
  if (refundInProgress) return REFUND_IN_PROCESS_LABEL;
  if (isRefundToBalance) return CANCELLATION_TO_BALANCE_LABEL;
  if (isReallocationOut) return REALLOCATION_OUT_LABEL;
  return STATUS_LABELS[data.status] || data.status || status;
}

/**
 * Warna PDF per status efektif: header (strip atas + tabel), stroke (border tabel), accent (teks INVOICE & status).
 * Memudahkan membedakan jenis invoice dari warna file.
 */
function getColorsForStatusLabel(statusLabel) {
  const s = (statusLabel || '').toLowerCase();
  const map = {
    lunas: { header: '#059669', stroke: '#047857', accent: '#047857' },
    'pembayaran dp': { header: '#D97706', stroke: '#B45309', accent: '#B45309' },
    'tagihan dp': { header: '#64748B', stroke: '#475569', accent: '#475569' },
    'refund diproses': { header: '#0284C7', stroke: '#0369A1', accent: '#0369A1' },
    'sudah direfund': { header: '#0D9488', stroke: '#0F766E', accent: '#0F766E' },
    'direfund ke saldo akun': { header: '#7C3AED', stroke: '#6D28D9', accent: '#6D28D9' },
    'dana dipindahkan ke invoice lain': { header: '#EA580C', stroke: '#C2410C', accent: '#C2410C' },
    'dibatalkan refund': { header: '#DC2626', stroke: '#B91C1C', accent: '#B91C1C' },
    'refund dibatalkan': { header: '#991B1B', stroke: '#7F1D1D', accent: '#7F1D1D' },
    dibatalkan: { header: '#DC2626', stroke: '#B91C1C', accent: '#B91C1C' },
    draft: { header: '#64748B', stroke: '#475569', accent: '#475569' },
    overdue: { header: '#DC2626', stroke: '#B91C1C', accent: '#B91C1C' },
    'order diupdate': { header: '#475569', stroke: '#334155', accent: '#334155' },
    'kelebihan bayar': { header: '#B45309', stroke: '#92400E', accent: '#92400E' },
    'sisa pengembalian': { header: '#B45309', stroke: '#92400E', accent: '#92400E' },
    processing: { header: '#0D1A63', stroke: '#1e3a8a', accent: '#0D1A63' },
    completed: { header: '#059669', stroke: '#047857', accent: '#047857' }
  };
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [key, colors] of entries) {
    if (s === key || s.includes(key)) return colors;
  }
  return { header: '#0D1A63', stroke: '#1e3a8a', accent: '#0D1A63' };
}

function formatAmount(amount, currency) {
  const n = parseFloat(amount || 0);
  if (!currency || currency === 'IDR') return formatIDR(n);
  if (currency === 'SAR') return formatSAR(n);
  if (currency === 'USD') return formatUSD(n);
  return `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

/** Format SAR lengkap: pemisah ribuan + 2 desimal + label SAR */
const formatSAR = (n) => `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} SAR`;
/** Format USD lengkap: pemisah ribuan + 2 desimal + label USD */
const formatUSD = (n) => `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} USD`;

/** Konversi IDR ke SAR dan USD dari currency_rates (SAR_TO_IDR, USD_TO_IDR) */
function idrToSarUsd(idr, currencyRates) {
  const cr = currencyRates || {};
  const SAR_TO_IDR = typeof cr.SAR_TO_IDR === 'number' ? cr.SAR_TO_IDR : 4200;
  const USD_TO_IDR = typeof cr.USD_TO_IDR === 'number' ? cr.USD_TO_IDR : 15500;
  const n = parseFloat(idr) || 0;
  return { sar: n / SAR_TO_IDR, usd: n / USD_TO_IDR };
}

function checkNewPage(doc, y, margin, need) {
  const bottomMargin = 80;
  if (y + need > doc.page.height - bottomMargin) {
    doc.addPage();
    return margin;
  }
  return y;
}

/** Ambil kurs untuk konversi: prioritaskan order/invoice override, lalu branch rules */
function getRates(data) {
  const orderRates = data.Order?.currency_rates_override;
  const invRates = data.currency_rates_override || data.currency_rates;
  if (orderRates && typeof orderRates === 'object' && (orderRates.SAR_TO_IDR != null || orderRates.USD_TO_IDR != null)) {
    return orderRates;
  }
  if (invRates && typeof invRates === 'object') return invRates;
  return {};
}

/**
 * @param {PDFDocument} doc
 * @param {object} data - invoice data (dari DB)
 * @param {Buffer} [logoBuffer] - optional logo buffer (background putih sudah dijadikan transparan)
 */
function renderInvoicePdf(doc, data, logoBuffer) {
  const margin = 48;
  const pageWidth = doc.page.width - margin * 2;
  let y = margin;

  const statusLabel = getEffectiveStatusLabel(data);
  const colors = getColorsForStatusLabel(statusLabel);

  // ---- Header modern: strip warna sesuai status + logo + judul ----
  const headerH = 72;
  doc.rect(0, 0, doc.page.width, headerH).fill(colors.header);
  const logoSize = 44;
  const logoX = margin;
  const logoY = (headerH - logoSize) / 2;
  let logoDrawn = false;
  if (logoBuffer && Buffer.isBuffer(logoBuffer)) {
    try {
      doc.image(logoBuffer, logoX, logoY, { width: logoSize, height: logoSize });
      logoDrawn = true;
    } catch (_) {}
  }
  if (!logoDrawn) {
    const logoPath = getLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
        logoDrawn = true;
      } catch (_) {}
    }
  }
  const titleX = margin + (logoDrawn ? logoSize + 12 : 0);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('BINTANG GLOBAL GROUP', titleX, 22);
  doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.9)').text('Travel & Umroh | Invoice Resmi', titleX, 48);
  doc.fillColor(colors.accent).fontSize(14).font('Helvetica-Bold').text('INVOICE', doc.page.width - margin - 80, 28);
  doc.fillColor('#334155');
  y = 88;

  // ---- Info utama: grid 2 baris x 3 kolom (rapi, tidak tumpang tindih) ----
  const infoColW = pageWidth / 3;
  const infoX = (col) => margin + col * infoColW + 10;
  doc.fontSize(9).fillColor('#64748b');
  doc.text('No. Invoice', infoX(0), y);
  doc.text('Status', infoX(1), y);
  y += 12;
  doc.fontSize(10).fillColor('#0f172a');
  doc.text(data.invoice_number || '-', infoX(0), y, { width: infoColW - 20 });
  doc.font('Helvetica-Bold').fillColor(colors.accent).text(statusLabel, infoX(1), y, { width: infoColW - 20 }).font('Helvetica').fillColor('#0f172a');
  y += 18;
  doc.fontSize(9).fillColor('#64748b');
  doc.text('Tanggal Terbit', infoX(0), y);
  doc.text('Jatuh Tempo DP', infoX(1), y);
  doc.text('Jatuh Tempo Lunas', infoX(2), y);
  y += 12;
  doc.fontSize(10).fillColor('#334155');
  doc.text(formatDate(data.issued_at || data.created_at), infoX(0), y, { width: infoColW - 20 });
  doc.text(formatDate(data.due_date_dp) || '-', infoX(1), y, { width: infoColW - 20 });
  doc.text(formatDate(data.due_date_full) || '-', infoX(2), y, { width: infoColW - 20 });
  y += 26;

  // ---- Dua kolom: Bill To | Cabang (garis pemisah, nilai dibatasi lebar) ----
  const col2StartX = margin + Math.floor(pageWidth * 0.5);
  const valW1 = col2StartX - margin - 90;
  const valW2 = pageWidth - (col2StartX - margin) - 20;
  const boxH = 80;
  doc.rect(margin, y, pageWidth, boxH).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.moveTo(col2StartX, y).lineTo(col2StartX, y + boxH).stroke('#cbd5e1');
  y += 10;
  doc.fontSize(8).fillColor('#64748b').text('DITAGIH KEPADA', margin + 12, y);
  doc.text('LOKASI', col2StartX + 12, y);
  y += 15;
  doc.fontSize(9).fillColor('#334155');
  doc.text('Nama', margin + 12, y);
  doc.text(String(data.User?.name || '-'), margin + 92, y, { width: valW1 });
  doc.text('Kota', col2StartX + 12, y);
  doc.text(String(data.Branch?.name || data.Branch?.code || '-'), col2StartX + 92, y, { width: valW2 - 82 });
  y += 14;
  doc.text('Perusahaan', margin + 12, y);
  doc.text(String(data.User?.company_name || '-'), margin + 92, y, { width: valW1 });
  const wilayahName = data.Branch?.Provinsi?.Wilayah?.name || '-';
  doc.text('Wilayah', col2StartX + 12, y);
  doc.text(String(wilayahName), col2StartX + 92, y, { width: valW2 - 82 });
  y += 14;
  const provinsiName = data.Branch?.Provinsi?.name || data.Branch?.Provinsi?.nama || '-';
  const ownerMouLabel = data.User?.OwnerProfile?.is_mou_owner ? 'Owner MOU' : 'Non-MOU';
  doc.fontSize(8).fillColor('#64748b').text('Tipe Owner', margin + 12, y);
  doc.fontSize(9).fillColor('#334155').text(ownerMouLabel, margin + 92, y, { width: valW1 });
  doc.text('Provinsi', col2StartX + 12, y);
  doc.text(String(provinsiName), col2StartX + 92, y, { width: valW2 - 82 });
  y += 14;
  doc.text('Email', margin + 12, y);
  doc.text(String(data.User?.email || '-'), margin + 92, y, { width: valW1 });
  doc.text('Kode Cabang', col2StartX + 12, y);
  doc.text(String(data.Branch?.code || '-'), col2StartX + 92, y, { width: valW2 - 82 });
  y += 22;

  // ---- Tabel Item: No | Tipe | Deskripsi | Qty | Harga Satuan | Subtotal ----
  y = checkNewPage(doc, y, margin, 140);
  doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text('Rincian Barang / Jasa', margin, y);
  y += 22;

  const tableTop = y;
  // Kolom: No, Tipe, Deskripsi, Qty, Harga Satuan Kamar, Harga Satuan Makan, Subtotal (pisah kamar/makan; subtotal gabungan)
  const colW = [0.04, 0.06, 0.24, 0.06, 0.18, 0.18, 0.24];
  const x = (i) => margin + pageWidth * colW.slice(0, i).reduce((s, w) => s + w, 0) + 6;
  const w = (i) => pageWidth * colW[i] - 12;
  const headerRowH = 36;
  const dataRowHMin = 48;
  const descLineGap = 5;
  const descBlockGap = 6;
  const rates = getRates(data);
  const s2i = (rates && rates.SAR_TO_IDR != null) ? rates.SAR_TO_IDR : 4200;
  const u2i = (rates && rates.USD_TO_IDR != null) ? rates.USD_TO_IDR : 15500;
  doc.rect(margin, tableTop, pageWidth, headerRowH).fillAndStroke(colors.header, colors.stroke);
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
  doc.text('No', x(0), tableTop + 8, { width: w(0) });
  doc.text('Tipe', x(1), tableTop + 8, { width: w(1) });
  doc.text('Deskripsi', x(2), tableTop + 8, { width: w(2) });
  doc.text('Qty', x(3), tableTop + 8, { width: w(3) });
  doc.text('Harga Satuan Kamar', x(4), tableTop + 6, { width: w(4) });
  doc.fontSize(7).font('Helvetica').text('(IDR)', x(4), tableTop + 18, { width: w(4) });
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Harga Satuan Makan', x(5), tableTop + 6, { width: w(5) });
  doc.fontSize(7).font('Helvetica').text('(IDR)', x(5), tableTop + 18, { width: w(5) });
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Subtotal (gabungan)', x(6), tableTop + 6, { width: w(6) });
  doc.fontSize(7).font('Helvetica').text('(IDR · SAR · USD)', x(6), tableTop + 18, { width: w(6) });
  doc.fontSize(9).font('Helvetica-Bold');
  y = tableTop + headerRowH;

  const items = data.Order?.OrderItems || [];
  /** Satu product hotel + banyak tipe kamar + tanggal sama → satu baris; rincian tipe kamar di Deskripsi. */
  const displayItems = (() => {
    const hotelKey = (it) => {
      const meta = it.meta && typeof it.meta === 'object' ? it.meta : {};
      const pid = it.product_ref_id || it.product_id || '';
      const ci = (meta.check_in || '').toString().slice(0, 10);
      const co = (meta.check_out || '').toString().slice(0, 10);
      return `${pid}|${ci}|${co}`;
    };
    const groups = new Map();
    items.forEach((it) => {
      if ((it.type || '').toLowerCase() !== 'hotel') return;
      const key = hotelKey(it);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    const seen = new Set();
    const result = [];
    items.forEach((it) => {
      if ((it.type || '').toLowerCase() !== 'hotel') {
        result.push(it);
        return;
      }
      const key = hotelKey(it);
      if (seen.has(key)) return;
      seen.add(key);
      const group = groups.get(key) || [];
      if (group.length === 0) return;
      if (group.length === 1) {
        result.push(group[0]);
        return;
      }
      const first = group[0];
      const meta0 = first.meta && typeof first.meta === 'object' ? first.meta : {};
      const ci = meta0.check_in ? formatDateShort(meta0.check_in) : '';
      const co = meta0.check_out ? formatDateShort(meta0.check_out) : '';
      const nights = meta0.nights != null ? Number(meta0.nights) : 0;
      const roomParts = group.map((it2) => {
        const m = it2.meta && typeof it2.meta === 'object' ? it2.meta : {};
        const rt = (m.room_type || 'quad').toString().toLowerCase();
        const q = it2.quantity != null ? Number(it2.quantity) : 1;
        return `${roomTypeLabel(rt)} × ${q}`;
      });
      const totalSub = group.reduce((s, it2) => s + (parseFloat(String(it2.subtotal || 0)) || 0), 0);
      const totalQty = group.reduce((s, it2) => s + (it2.quantity != null ? Number(it2.quantity) : 1), 0);
      // Breakdown subtotal kamar vs makan untuk baris gabungan (agar Harga Satuan Makan & Subtotal gabungan konsisten).
      let mergedRoomSub = 0;
      let mergedMealSub = 0;
      let mergedOrangNights = 0;
      group.forEach((it2) => {
        const m = it2.meta && typeof it2.meta === 'object' ? it2.meta : {};
        const q = it2.quantity != null ? Number(it2.quantity) : 1;
        const rt = (m.room_type || 'quad').toString().toLowerCase();
        const cap = ROOM_CAPACITY[String(rt)] ?? 1;
        const totalOrang = q * cap;
        const cur2 = (it2.unit_price_currency || 'IDR').toUpperCase();
        const toIdr2 = (v) => (cur2 === 'SAR' ? v * s2i : cur2 === 'USD' ? v * u2i : v);
        const roomUnitRaw2 = m.room_unit_price != null ? parseFloat(m.room_unit_price) : (it2.unit_price != null ? parseFloat(it2.unit_price) : 0);
        const mealUnitRaw2 = m.meal_unit_price != null ? parseFloat(m.meal_unit_price) : NaN;
        const roomUnitIdr2 = Number.isFinite(roomUnitRaw2) ? toIdr2(roomUnitRaw2) : 0;
        let mealUnitIdr2 = Number.isFinite(mealUnitRaw2) ? toIdr2(mealUnitRaw2) : 0;
        const withMeal2 = m.meal === true || m.with_meal === true;
        const roomPart2 = nights > 0 ? roomUnitIdr2 * q * nights : 0;
        let mealPart2 = (withMeal2 && nights > 0 && mealUnitIdr2 > 0) ? mealUnitIdr2 * totalOrang * nights : 0;
        const itemSubtotal2 = parseFloat(String(it2.subtotal || 0)) || 0;
        if (withMeal2 && nights > 0 && mealUnitIdr2 <= 0 && roomPart2 > 0 && itemSubtotal2 > roomPart2 && (totalOrang * nights) > 0) {
          mealPart2 = itemSubtotal2 - roomPart2;
          mealUnitIdr2 = mealPart2 / (totalOrang * nights);
        }
        mergedRoomSub += roomPart2 > 0 ? roomPart2 : Math.max(0, itemSubtotal2 - mealPart2);
        mergedMealSub += mealPart2 > 0 ? mealPart2 : 0;
        if (withMeal2 && nights > 0 && (totalOrang * nights) > 0) mergedOrangNights += (totalOrang * nights);
      });
      const mergedMealUnitIdr = mergedOrangNights > 0 ? (mergedMealSub / mergedOrangNights) : 0;
      result.push({
        ...first,
        _merged: true,
        _mergedDateLine: `Check-in: ${ci || '-'}, Check-out: ${co || '-'}`,
        _mergedMealLine: `${nights ? `${nights} malam. ` : ''}${roomParts.join(', ')}`,
        _mergedSubtotal: totalSub,
        _mergedQty: totalQty,
        _mergedNights: nights,
        _mergedRoomSubtotal: mergedRoomSub,
        _mergedMealSubtotal: mergedMealSub,
        _mergedMealUnitIdr: mergedMealUnitIdr,
        _mergedOrangNights: mergedOrangNights,
        quantity: totalQty,
        subtotal: totalSub
      });
    });
    // Baris sintetis: Bus include (dengan visa) bila order punya visa dan tidak ada item bus
    const hasVisa = items.some((it) => (it.type || '').toLowerCase() === 'visa');
    const hasBusItems = items.some((it) => (it.type || '').toLowerCase() === 'bus');
    if (hasVisa && !hasBusItems && data.Order) {
      const penalty = parseFloat(String(data.Order.penalty_amount || 0)) || 0;
      const waive = !!(data.Order.waive_bus_penalty);
      const desc = waive ? 'Tanpa penalti (Hiace)' : (penalty > 0 ? `Penalti bus: Rp ${(penalty / 1e6).toFixed(0)} jt (visa < 35 pack)` : 'Termasuk dengan visa');
      result.push({
        _busInclude: true,
        type: 'bus',
        penalty_amount: penalty,
        waive_bus_penalty: waive,
        _busIncludeDesc: desc,
        subtotal: penalty > 0 && !waive ? penalty : 0
      });
    }
    return result;
  })();

  let totalAmount = parseFloat(String(data.total_amount || 0));
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    totalAmount = parseFloat(String(data.Order?.total_amount || 0)) || 0;
  }
  const invStatus = String(data.status || '').toLowerCase();
  const paidAmtForZero = parseFloat(data.paid_amount || 0);
  if (['canceled', 'cancelled', 'cancelled_refund'].includes(invStatus) && paidAmtForZero <= 0) {
    totalAmount = 0;
  }
  // Tanggal referensi: check-in hotel paling awal (untuk visa = sesuai check-in, tiket = 1 hari sebelum check-in)
  let hotelCheckIn = null;
  items.forEach((it) => {
    if ((it.type || '').toLowerCase() !== 'hotel') return;
    const meta = it.meta && typeof it.meta === 'object' ? it.meta : {};
    const ci = meta.check_in ? new Date(meta.check_in) : null;
    if (ci && (!hotelCheckIn || ci < hotelCheckIn)) hotelCheckIn = ci;
  });
  const hasTicketOrVisa = items.some((it) => { const t = (it.type || '').toLowerCase(); return t === 'ticket' || t === 'visa'; });
  const ticketDeparture = hotelCheckIn && hasTicketOrVisa ? new Date(hotelCheckIn) : null;
  if (ticketDeparture) ticketDeparture.setDate(ticketDeparture.getDate() - 1);

  doc.fillColor('#334155').font('Helvetica');
  if (displayItems.length > 0) {
    displayItems.forEach((item, i) => {
      if (item._busInclude) {
        const rowH = dataRowHMin;
        y = checkNewPage(doc, y, margin, rowH + 6);
        doc.rect(margin, y - 2, pageWidth, rowH).stroke('#e2e8f0');
        doc.fillColor('#334155').fontSize(9);
        doc.text(String(i + 1), x(0), y + 6, { width: w(0) });
        doc.text('Bus', x(1), y + 6, { width: w(1) });
        doc.text('Bus include (dengan visa)', x(2), y + 4, { width: w(2) });
        if (item._busIncludeDesc) {
          doc.fontSize(7).fillColor('#64748b');
          doc.text(item._busIncludeDesc, x(2), y + 18, { width: w(2) });
        }
        doc.fontSize(9).fillColor('#334155');
        doc.text('–', x(3), y + 6, { width: w(3) });
        doc.text('–', x(4), y + 6, { width: w(4) });
        doc.text('–', x(5), y + 6, { width: w(5) });
        const subVal = item.subtotal > 0 ? item.subtotal : 0;
        if (subVal > 0) {
          doc.text(formatIDR(subVal), x(6), y + 4, { width: w(6) });
          const subSarUsd = idrToSarUsd(subVal, rates);
          doc.fontSize(7).fillColor('#64748b');
          doc.text(`${formatSAR(subSarUsd.sar)}  |  ${formatUSD(subSarUsd.usd)}`, x(6), y + 14, { width: w(6) });
        } else {
          doc.text('–', x(6), y + 6, { width: w(6) });
        }
        doc.fontSize(9).fillColor('#334155');
        y += rowH;
        return;
      }
      const itemType = (item.type || '').toLowerCase();
      const isMerged = !!item._merged;
      const desc = (item.Product?.name || item.product_name || `${typeLabel(item.type)} ${i + 1}`).toString();
      let dateLine = '';
      let mealLine = '';
      let calcLine = '';
      /** Untuk hotel: baris harga satuan kamar/makan dan rumus subtotal (jika meta punya room_unit_price). Baris gabungan (banyak tipe kamar) pakai deskripsi saja, tanpa breakdown harga satuan. */
      let unitPriceBreakdownLines = [];
      let subtotalFormulaLine = '';
      let hotelSubtotalFromFormula = 0;
      let hotelRoomUnitIdr = 0;
      let hotelMealUnitIdr = 0;
      let hotelWithMeal = false;
      if (isMerged) {
        dateLine = item._mergedDateLine || '';
        mealLine = item._mergedMealLine || '';
        const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
        hotelWithMeal = meta.meal === true || meta.with_meal === true;
        const cur = (item.unit_price_currency || 'IDR').toUpperCase();
        const toIdr = (v) => (cur === 'SAR' ? v * s2i : cur === 'USD' ? v * u2i : v);
        const roomUnitRaw = meta.room_unit_price != null ? parseFloat(meta.room_unit_price) : (item.unit_price != null ? parseFloat(item.unit_price) : NaN);
        const mealUnitRaw = meta.meal_unit_price != null ? parseFloat(meta.meal_unit_price) : NaN;
        if (Number.isFinite(roomUnitRaw)) hotelRoomUnitIdr = toIdr(roomUnitRaw);
        // Prioritas: hasil breakdown merged (lebih akurat) → fallback meta item pertama
        if (item._mergedMealUnitIdr != null && parseFloat(String(item._mergedMealUnitIdr)) > 0) hotelMealUnitIdr = parseFloat(String(item._mergedMealUnitIdr));
        else if (Number.isFinite(mealUnitRaw)) hotelMealUnitIdr = toIdr(mealUnitRaw);
        const mergedRoomSub = parseFloat(String(item._mergedRoomSubtotal || 0)) || 0;
        const mergedMealSub = parseFloat(String(item._mergedMealSubtotal || 0)) || 0;
        if (mergedRoomSub > 0 || mergedMealSub > 0) {
          hotelSubtotalFromFormula = mergedRoomSub + mergedMealSub;
          subtotalFormulaLine = mergedMealSub > 0
            ? `Subtotal: (Kamar ${formatIDR(mergedRoomSub)}) + (Makan ${formatIDR(mergedMealSub)}) = ${formatIDR(hotelSubtotalFromFormula)}`
            : `Subtotal: Kamar ${formatIDR(mergedRoomSub)} = ${formatIDR(hotelSubtotalFromFormula)}`;
        }
      } else if (itemType === 'hotel') {
        const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
        const ci = meta.check_in ? formatDateShort(meta.check_in) : null;
        const co = meta.check_out ? formatDateShort(meta.check_out) : null;
        if (ci || co) dateLine = `Check-in: ${ci || '-'}, Check-out: ${co || '-'}`;
        const withMeal = meta.meal === true || meta.with_meal === true;
        hotelWithMeal = withMeal;
        const mealStatus = item.HotelProgress?.meal_status;
        const hotelStatus = item.HotelProgress?.status;
        const roomType = meta.room_type;
        const nights = meta.nights != null ? Number(meta.nights) : 0;
        const qtyRooms = item.quantity != null ? Number(item.quantity) : 1;
        const capacity = ROOM_CAPACITY[String(roomType || '').toLowerCase()] ?? 1;
        const totalOrang = qtyRooms * capacity;
        const cur = (item.unit_price_currency || 'IDR').toUpperCase();
        const toIdr = (v) => (cur === 'SAR' ? v * s2i : cur === 'USD' ? v * u2i : v);
        const roomUnitRaw = meta.room_unit_price != null ? parseFloat(meta.room_unit_price) : (item.unit_price != null ? parseFloat(item.unit_price) : NaN);
        const mealUnitRaw = meta.meal_unit_price != null ? parseFloat(meta.meal_unit_price) : NaN;
        if (Number.isFinite(roomUnitRaw)) hotelRoomUnitIdr = toIdr(roomUnitRaw);
        if (Number.isFinite(mealUnitRaw)) hotelMealUnitIdr = toIdr(mealUnitRaw);
        const parts = [];
        if (hotelStatus) parts.push(`Status hotel: ${hotelProgressStatusLabel(hotelStatus)}`);
        if (nights > 0) parts.push(`${qtyRooms} kamar × ${nights} malam`);
        if (mealStatus) parts.push(`Status makan: ${mealStatusLabel(mealStatus)}`);
        if (roomType) parts.push(`Tipe kamar: ${roomTypeLabel(roomType)}`);
        if (parts.length) mealLine = parts.join('  |  ');
        if (withMeal && nights > 0 && qtyRooms > 0) {
          const totalOrangMalam = totalOrang * nights;
          calcLine = `Perhitungan: ${totalOrang} orang × ${nights} malam = ${totalOrangMalam} (paket makan: Ya)`;
        } else if (withMeal) {
          calcLine = 'Perhitungan: paket makan termasuk dalam harga.';
        }
        const roomPart = hotelRoomUnitIdr * qtyRooms * nights;
        if (nights > 0 && (meta.room_unit_price != null || meta.meal_unit_price != null || (withMeal && roomPart > 0))) {
          let mealPart = withMeal && hotelMealUnitIdr > 0 ? hotelMealUnitIdr * totalOrang * nights : 0;
          if (withMeal && hotelMealUnitIdr <= 0 && roomPart > 0 && totalOrang * nights > 0) {
            const itemSubtotal = parseFloat(String(item.subtotal || 0));
            if (Number.isFinite(itemSubtotal) && itemSubtotal > roomPart) {
              mealPart = itemSubtotal - roomPart;
              hotelMealUnitIdr = mealPart / (totalOrang * nights);
            }
          }
          unitPriceBreakdownLines.push(`Harga satuan kamar: ${formatIDR(hotelRoomUnitIdr)}`);
          if (withMeal && hotelMealUnitIdr > 0) {
            unitPriceBreakdownLines.push(`Harga satuan makan: ${formatIDR(hotelMealUnitIdr)}`);
          }
          hotelSubtotalFromFormula = roomPart + mealPart;
          subtotalFormulaLine = mealPart > 0
            ? `Subtotal: (Kamar ${formatIDR(roomPart)}) + (Makan ${formatIDR(mealPart)}) = ${formatIDR(hotelSubtotalFromFormula)}`
            : `Subtotal: Kamar ${formatIDR(roomPart)} = ${formatIDR(hotelSubtotalFromFormula)}`;
        }
      } else if (itemType === 'visa') {
        const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
        const travelDate = meta.travel_date ? formatDateShort(meta.travel_date) : null;
        if (travelDate) dateLine = `Tanggal keberangkatan: ${travelDate}`;
        else if (hotelCheckIn) dateLine = `Tanggal sesuai check-in hotel: ${formatDateShort(hotelCheckIn)}`;
      } else if (itemType === 'ticket') {
        const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
        const bandara = meta.bandara ? `Bandara ${meta.bandara}` : '';
        const tripType = tripTypeLabel(meta.trip_type);
        const dep = meta.departure_date ? formatDateShort(meta.departure_date) : (ticketDeparture ? formatDateShort(ticketDeparture) : null);
        const ret = meta.return_date ? formatDateShort(meta.return_date) : null;
        const parts = [bandara, tripType].filter(Boolean);
        if (dep || ret) parts.push(dep ? `Berangkat: ${dep}` : '', ret ? `Pulang: ${ret}` : '');
        dateLine = parts.filter(Boolean).join('  |  ') || (ticketDeparture ? `Keberangkatan: ${formatDateShort(ticketDeparture)} (1 hari sebelum check-in)` : '');
      } else if (itemType === 'bus') {
        const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
        const tripType = tripTypeLabel(meta.trip_type);
        const travelDate = meta.travel_date ? formatDateShort(meta.travel_date) : null;
        const route = meta.route_type ? busRouteLabel(meta.route_type) : '';
        const busType = meta.bus_type ? busTypeLabel(meta.bus_type) : '';
        const parts = [tripType, travelDate ? `Tgl: ${travelDate}` : '', route, busType].filter(Boolean);
        if (parts.length) mealLine = parts.join('  |  ');
      }
      const qty = isMerged ? (item._mergedQty ?? item.quantity ?? 1) : (item.quantity != null ? Number(item.quantity) : 1);
      const metaForQty = itemType === 'hotel' && item.meta && typeof item.meta === 'object' ? item.meta : {};
      const nightsForDisplay = isMerged ? (item._mergedNights ?? metaForQty.nights ?? 0) : (metaForQty.nights != null ? Number(metaForQty.nights) : 0);
      const effectiveQty = (itemType === 'hotel' && nightsForDisplay > 0) ? qty * nightsForDisplay : qty;
      let unitPrice = parseFloat(String(item.unit_price || 0));
      if (!Number.isFinite(unitPrice)) unitPrice = 0;
      const cur = (item.unit_price_currency || 'IDR').toUpperCase();
      const unitPriceIdr = cur === 'SAR' ? unitPrice * s2i : cur === 'USD' ? unitPrice * u2i : unitPrice;
      let subtotalVal = isMerged ? (parseFloat(String(item._mergedSubtotal ?? item.subtotal ?? 0)) || 0) : parseFloat(String(item.subtotal || 0));
      if (itemType === 'hotel' && hotelSubtotalFromFormula > 0) {
        subtotalVal = hotelSubtotalFromFormula;
      } else if (!Number.isFinite(subtotalVal) || subtotalVal <= 0) {
        subtotalVal = unitPriceIdr * effectiveQty;
      }
      const qtyLabel = (itemType === 'hotel' && nightsForDisplay > 0) ? `${qty} × ${nightsForDisplay}` : String(qty);
      const unitSarUsd = idrToSarUsd(unitPriceIdr, rates);
      const subSarUsd = idrToSarUsd(subtotalVal, rates);
      doc.fontSize(9);
      const descStr = desc.slice(0, 55);
      const descHeight = doc.heightOfString(descStr, { width: w(2) });
      doc.fontSize(7);
      const dateHeight = dateLine ? doc.heightOfString(dateLine, { width: w(2) }) : 0;
      const mealHeight = mealLine ? doc.heightOfString(mealLine, { width: w(2) }) : 0;
      const calcHeight = calcLine ? doc.heightOfString(calcLine, { width: w(2) }) : 0;
      const subtotalFormulaHeight = subtotalFormulaLine ? doc.heightOfString(subtotalFormulaLine, { width: w(6) }) : 0;
      doc.fontSize(9);
      const priceBlockH = 22;
      const rowH = Math.max(
        dataRowHMin,
        Math.ceil(descHeight) + descBlockGap + Math.ceil(dateHeight) + (dateLine && (mealLine || calcLine) ? descBlockGap : 0) + Math.ceil(mealHeight) + (mealLine && calcLine ? descBlockGap : 0) + Math.ceil(calcHeight) + (calcLine && subtotalFormulaLine ? descBlockGap : 0) + (subtotalFormulaLine ? 8 + Math.ceil(subtotalFormulaHeight) : 0) + priceBlockH
      );
      y = checkNewPage(doc, y, margin, rowH + 6);
      doc.rect(margin, y - 2, pageWidth, rowH).stroke('#e2e8f0');
      doc.fillColor('#334155').fontSize(9);
      doc.text(String(i + 1), x(0), y + 6, { width: w(0) });
      doc.text(typeLabel(item.type), x(1), y + 6, { width: w(1) });
      doc.text(descStr, x(2), y + 4, { width: w(2) });
      let blockY = y + 4 + Math.ceil(descHeight) + descBlockGap;
      if (dateLine) {
        doc.fontSize(7).fillColor('#64748b');
        doc.text(dateLine, x(2), blockY, { width: w(2) });
        blockY += Math.ceil(dateHeight) + descBlockGap;
      }
      if (mealLine) {
        doc.fontSize(7).fillColor('#64748b');
        doc.text(mealLine, x(2), blockY, { width: w(2) });
        blockY += Math.ceil(mealHeight) + (calcLine ? descBlockGap : 0);
      }
      if (calcLine) {
        doc.fontSize(7).fillColor('#0f766e');
        doc.text(calcLine, x(2), blockY, { width: w(2) });
        blockY += Math.ceil(calcHeight) + (subtotalFormulaLine ? descBlockGap : 0);
      }
      doc.fontSize(9).fillColor('#334155');
      const qtyY = y + Math.min(14, Math.floor(rowH / 2) - 6);
      doc.text(qtyLabel, x(3), qtyY, { width: w(3) });
      // Kolom 4: Harga Satuan Kamar (pisah) + SAR/USD; baris gabungan pakai harga dari item pertama
      if (isMerged) {
        if (hotelRoomUnitIdr > 0) {
          doc.fontSize(8).fillColor('#334155');
          doc.text(formatIDR(hotelRoomUnitIdr), x(4), y + 4, { width: w(4) });
          doc.fontSize(7).fillColor('#64748b');
          const roomSarUsd = idrToSarUsd(hotelRoomUnitIdr, rates);
          doc.text(`${formatSAR(roomSarUsd.sar)}  |  ${formatUSD(roomSarUsd.usd)}`, x(4), y + 14, { width: w(4) });
        } else {
          doc.text(unitPriceIdr > 0 ? formatIDR(unitPriceIdr) : '–', x(4), y + 4, { width: w(4) });
          if (unitPriceIdr > 0) {
            doc.fontSize(7).fillColor('#64748b');
            doc.text(`${formatSAR(unitSarUsd.sar)}  |  ${formatUSD(unitSarUsd.usd)}`, x(4), y + 14, { width: w(4) });
          }
        }
      } else if (unitPriceBreakdownLines.length > 0) {
        doc.fontSize(8).fillColor('#334155');
        doc.text(formatIDR(hotelRoomUnitIdr), x(4), y + 4, { width: w(4) });
        doc.fontSize(7).fillColor('#64748b');
        const roomSarUsd = idrToSarUsd(hotelRoomUnitIdr, rates);
        doc.text(`${formatSAR(roomSarUsd.sar)}  |  ${formatUSD(roomSarUsd.usd)}`, x(4), y + 14, { width: w(4) });
      } else {
        doc.text(formatIDR(unitPriceIdr), x(4), y + 4, { width: w(4) });
        doc.fontSize(7).fillColor('#64748b');
        doc.text(`${formatSAR(unitSarUsd.sar)}  |  ${formatUSD(unitSarUsd.usd)}`, x(4), y + 14, { width: w(4) });
      }
      // Kolom 5: Harga Satuan Makan (pisah) + SAR/USD; baris gabungan pakai harga dari item pertama
      doc.fontSize(9).fillColor('#334155');
      if (isMerged) {
        if (hotelMealUnitIdr > 0) {
          doc.fontSize(8).fillColor('#334155');
          doc.text(formatIDR(hotelMealUnitIdr), x(5), y + 4, { width: w(5) });
          doc.fontSize(7).fillColor('#64748b');
          const mealSarUsd = idrToSarUsd(hotelMealUnitIdr, rates);
          doc.text(`${formatSAR(mealSarUsd.sar)}  |  ${formatUSD(mealSarUsd.usd)}`, x(5), y + 14, { width: w(5) });
        } else {
          doc.text(hotelWithMeal ? 'Gratis' : '–', x(5), y + 4, { width: w(5) });
        }
      } else if (unitPriceBreakdownLines.length > 0) {
        doc.fontSize(8).fillColor('#334155');
        doc.text(hotelMealUnitIdr > 0 ? formatIDR(hotelMealUnitIdr) : (hotelWithMeal ? 'Gratis' : '–'), x(5), y + 4, { width: w(5) });
        if (hotelMealUnitIdr > 0) {
          doc.fontSize(7).fillColor('#64748b');
          const mealSarUsd = idrToSarUsd(hotelMealUnitIdr, rates);
          doc.text(`${formatSAR(mealSarUsd.sar)}  |  ${formatUSD(mealSarUsd.usd)}`, x(5), y + 14, { width: w(5) });
        }
      } else {
        doc.text('–', x(5), y + 4, { width: w(5) });
      }
      doc.fontSize(9).fillColor('#334155');
      // Kolom 6: Subtotal (gabungan) + rumus
      doc.text(formatIDR(subtotalVal), x(6), y + 4, { width: w(6) });
      doc.fontSize(7).fillColor('#64748b');
      doc.text(`${formatSAR(subSarUsd.sar)}  |  ${formatUSD(subSarUsd.usd)}`, x(6), y + 14, { width: w(6) });
      if (subtotalFormulaLine) {
        doc.fontSize(6).fillColor('#0d9488');
        doc.text(subtotalFormulaLine, x(6), y + 24, { width: w(6) });
      }
      doc.fontSize(9).fillColor('#334155');
      y += rowH;
    });
  } else {
    const totalSarUsd = idrToSarUsd(totalAmount, rates);
    const emptyRowH = dataRowHMin;
    doc.rect(margin, y - 2, pageWidth, emptyRowH).stroke('#e2e8f0');
    doc.fontSize(9).fillColor('#334155');
    doc.text('1', x(0), y + 6, { width: w(0) });
    doc.text('Paket', x(1), y + 6, { width: w(1) });
    doc.text('Layanan Umroh', x(2), y + 6, { width: w(2) });
    doc.text('1', x(3), y + 6, { width: w(3) });
    doc.text(formatIDR(totalAmount), x(4), y + 4, { width: w(4) });
    doc.text('–', x(5), y + 4, { width: w(5) });
    doc.fontSize(7).fillColor('#64748b');
    doc.text(`${formatSAR(totalSarUsd.sar)}  |  ${formatUSD(totalSarUsd.usd)}`, x(4), y + 14, { width: w(4) });
    doc.fontSize(9).fillColor('#334155');
    doc.text(formatIDR(totalAmount), x(6), y + 4, { width: w(6) });
    doc.fontSize(7).fillColor('#64748b');
    doc.text(`${formatSAR(totalSarUsd.sar)}  |  ${formatUSD(totalSarUsd.usd)}`, x(6), y + 14, { width: w(6) });
    doc.fontSize(9).fillColor('#334155');
    y += emptyRowH;
  }
  y += 16;

  // ---- Ringkasan Keuangan (card + SAR/USD untuk kemudahan pembayaran) ----
  y = checkNewPage(doc, y, margin, 165);
  const boxW = 300;
  const amountBoxW = 165;
  const boxLeft = doc.page.width - margin - boxW;
  const dpPct = parseInt(data.dp_percentage, 10) || 30;
  const dpAmount = parseFloat(data.dp_amount || 0) || Math.round(totalAmount * dpPct / 100);
  const paidAmount = parseFloat(data.paid_amount || 0);
  const remainingAmount = parseFloat(String(data.remaining_amount ?? (totalAmount - paidAmount)));
  const overpaidAmount = parseFloat(data.overpaid_amount || 0);
  const totalSarUsd = idrToSarUsd(totalAmount, rates);
  const remainingSarUsd = idrToSarUsd(remainingAmount, rates);
  doc.rect(boxLeft, y, boxW, 155).fillAndStroke('#eef2ff', '#93c5fd');
  let by = y + 12;
  const amountX = boxLeft + boxW - 14 - amountBoxW;
  doc.fontSize(10).fillColor(colors.accent);
  doc.text('Total Tagihan', boxLeft + 14, by);
  doc.text(formatIDR(totalAmount), amountX, by, { width: amountBoxW, align: 'right' });
  by += 11;
  doc.fontSize(7).fillColor('#64748b');
  doc.text(`${formatSAR(totalSarUsd.sar)}  |  ${formatUSD(totalSarUsd.usd)}`, amountX, by, { width: amountBoxW, align: 'right' });
  by += 16;
  doc.fontSize(10).fillColor(colors.accent);
  doc.text(`DP (${dpPct}%)`, boxLeft + 14, by);
  doc.text(formatIDR(dpAmount), amountX, by, { width: amountBoxW, align: 'right' });
  by += 18;
  doc.font('Helvetica-Bold').text('Total Dibayar', boxLeft + 14, by);
  doc.text(formatIDR(paidAmount), amountX, by, { width: amountBoxW, align: 'right' });
  by += 18;
  doc.font('Helvetica').text('Sisa Tagihan', boxLeft + 14, by);
  doc.text(formatIDR(remainingAmount), amountX, by, { width: amountBoxW, align: 'right' });
  by += 11;
  doc.fontSize(7).fillColor('#64748b');
  doc.text(`${formatSAR(remainingSarUsd.sar)}  |  ${formatUSD(remainingSarUsd.usd)}`, amountX, by, { width: amountBoxW, align: 'right' });
  by += 16;
  if (overpaidAmount > 0) {
    doc.fontSize(10).fillColor('#b45309').text('Kelebihan Bayar', boxLeft + 14, by);
    doc.text(formatIDR(overpaidAmount), amountX, by, { width: amountBoxW, align: 'right' });
    by += 18;
  }
  y += 162;

  // ---- Rincian Pembayaran (jumlah pembayaran per bukti) ----
  const proofs = (data.PaymentProofs || []).slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  if (proofs.length > 0) {
    y = checkNewPage(doc, y, margin, 120);
    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text('Rincian Pembayaran', margin, y);
    y += 20;
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Setiap baris = satu bukti transfer. Status verifikasi dan verifikator (seperti di Riwayat Status) tercantum di kolom Status.', margin, y);
    y += 28;

    const payTableTop = y;
    // No, Tgl, Tipe, Jumlah, Mata Uang, Status (gabungan status + oleh), Rek.Pengirim, Rek.Penerima
    const pc = [0.04, 0.12, 0.06, 0.14, 0.06, 0.20, 0.19, 0.19];
    const px = (i) => margin + pageWidth * pc.slice(0, i).reduce((s, w) => s + w, 0) + 4;
    const pw = (i) => pageWidth * pc[i] - 8;
    const headerRowH = 28;
    doc.rect(margin, payTableTop, pageWidth, headerRowH).fillAndStroke('#f1f5f9', '#e2e8f0');
    doc.fontSize(7).fillColor('#475569').font('Helvetica-Bold');
    doc.text('No', px(0), payTableTop + 8, { width: pw(0) });
    doc.text('Tgl Transfer', px(1), payTableTop + 8, { width: pw(1) });
    doc.text('Tipe', px(2), payTableTop + 8, { width: pw(2) });
    doc.text('Jumlah', px(3), payTableTop + 8, { width: pw(3) });
    doc.text('Mata Uang', px(4), payTableTop + 8, { width: pw(4) });
    doc.text('Status', px(5), payTableTop + 6, { width: pw(5) });
    doc.fontSize(6).fillColor('#64748b').text('(verifikasi & verifikator)', px(5), payTableTop + 15, { width: pw(5) });
    doc.fontSize(7).fillColor('#475569');
    doc.text('Rek. Pengirim', px(6), payTableTop + 8, { width: pw(6) });
    doc.text('Rek. Penerima', px(7), payTableTop + 8, { width: pw(7) });
    y = payTableTop + headerRowH + 2;

    const dataRowMinH = 32;
    const cellFontSize = 7;
    proofs.forEach((p, idx) => {
      const currency = (p.payment_currency || 'IDR').toUpperCase();
      const amountDisplay = (currency !== 'IDR' && p.amount_original != null)
        ? formatAmount(p.amount_original, currency)
        : formatIDR(parseFloat(p.amount || 0));
      const senderBank = p.bank_name || p.Bank?.name || '';
      const senderName = p.sender_account_name || '';
      const senderNo = p.sender_account_number || p.account_number || '';
      const senderStr = [senderBank, senderName, senderNo].filter(Boolean).join(' · ') || (p.payment_location === 'saudi' ? 'Pembayaran Saudi' : '–');
      const rec = p.RecipientAccount;
      const recipientStr = rec ? [rec.bank_name, rec.name, rec.account_number].filter(Boolean).join(' · ') || '–' : '–';
      const statusLabel = verifiedStatusLabel(p.verified_status);
      const verifier = p.VerifiedBy?.name || (p.verified_at ? 'Admin' : '');
      const statusBlock = verifier ? `${statusLabel}\noleh: ${verifier}` : statusLabel;
      doc.fontSize(cellFontSize).fillColor('#334155').font('Helvetica');
      const senderH = doc.heightOfString(String(senderStr), { width: pw(6) });
      const recipientH = doc.heightOfString(String(recipientStr), { width: pw(7) });
      const statusH = doc.heightOfString(statusBlock, { width: pw(5) });
      const rowH = Math.max(dataRowMinH, Math.ceil(Math.max(senderH, recipientH, statusH)) + 14);
      y = checkNewPage(doc, y, margin, rowH + 4);
      doc.rect(margin, y - 2, pageWidth, rowH).stroke('#f1f5f9');
      doc.text(String(idx + 1), px(0), y + 8, { width: pw(0) });
      doc.text(formatDate(p.transfer_date), px(1), y + 8, { width: pw(1) });
      doc.text(paymentTypeLabel(p.payment_type), px(2), y + 8, { width: pw(2) });
      doc.text(amountDisplay, px(3), y + 8, { width: pw(3) });
      doc.text(currency || 'IDR', px(4), y + 8, { width: pw(4) });
      doc.text(statusBlock, px(5), y + 8, { width: pw(5) });
      doc.text(String(senderStr), px(6), y + 8, { width: pw(6) });
      doc.text(String(recipientStr), px(7), y + 8, { width: pw(7) });
      y += rowH + 2;
    });
    y += 8;
    doc.fontSize(9).fillColor(colors.accent).font('Helvetica-Bold');
    const totalPaidFromProofs = proofs.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    doc.text(`Total Jumlah Pembayaran (dari ${proofs.length} bukti): ${formatIDR(totalPaidFromProofs)}`, margin, y);
    y += 22;
  }

  // ---- Terms & Catatan (wrap teks agar tidak terpotong) ----
  const terms = Array.isArray(data.terms) ? data.terms : (data.terms ? [data.terms] : []);
  if (terms.length > 0 || (data.notes && String(data.notes).trim())) {
    y = checkNewPage(doc, y, margin, 80);
    doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('Ketentuan & Catatan', margin, y);
    y += 20;
    doc.fontSize(9).fillColor('#64748b').font('Helvetica');
    const termsWidth = pageWidth - 24;
    terms.forEach((t) => {
      const line = `• ${String(t)}`;
      const h = doc.heightOfString(line, { width: termsWidth });
      doc.text(line, margin + 8, y, { width: termsWidth });
      y += h + 4;
    });
    if (data.notes && String(data.notes).trim()) {
      const noteLine = `Catatan: ${data.notes}`;
      const h = doc.heightOfString(noteLine, { width: termsWidth });
      doc.text(noteLine, margin + 8, y, { width: termsWidth });
      y += h + 8;
    } else {
      y += 8;
    }
  }

  // ---- Footer ----
  doc.fontSize(8).fillColor('#94a3b8');
  doc.text(`Dokumen ini dicetak pada ${new Date().toLocaleString('id-ID')} | Bintang Global Group - Travel & Umroh`, margin, doc.page.height - 36, { align: 'center', width: pageWidth });
}

async function buildInvoicePdfBuffer(data) {
  const logoBuffer = await getLogoBufferTransparent(getLogoPath());
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoicePdf(doc, data, logoBuffer);
    doc.end();
  });
}

module.exports = { renderInvoicePdf, buildInvoicePdfBuffer, formatIDR, formatDate, STATUS_LABELS, getEffectiveStatusLabel };
