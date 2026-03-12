/**
 * Import ORDERAN HOTEL BG ledger (MAKKAH / MADINAH) ke tabel rekap_hotel.
 *
 * Contoh pakai (dari folder backend):
 *   node scripts/import-orderan-hotel-ledger.js "C:\\Users\\preed\\Downloads\\ORDERAN HOTEL BG\\MAKKAH.html" "C:\\Users\\preed\\Downloads\\ORDERAN HOTEL BG\\MADINAH.html"
 *
 * Setiap file akan:
 * - Hapus dulu data lama untuk period_name = nama file (tanpa .html) dan source_type = 'order_list'
 * - Insert baris baru ke rekap_hotel dengan kolom:
 *   TNTV (tentative), DFNT (definite), CLIENT (client), HOTEL (hotel_makkah/hotel_madinah),
 *   IN/OUT (check_in/check_out), TOTAL HARI (total_hari), D/T/Q/Qn/Hx/Room/Pax,
 *   BB/FB, Available/Booked/Amend/LUNAS, Voucher, Keterangan, Invoice Clerk.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

process.chdir(path.join(__dirname, '..'));

const sequelize = require('../src/config/sequelize');
const { RekapHotel } = require('../src/models');

function stripTags(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim();
}

function extractCells(trHtml) {
  const cells = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m;
  while ((m = re.exec(trHtml)) !== null) {
    cells.push(stripTags(m[1]));
  }
  return cells;
}

function parseDateId(text) {
  if (!text) return null;
  const s = text.trim();
  if (!s) return null;
  if (/invalid\s*date|invalid date/i.test(s)) return null;
  // Format umum: "10 Mei 2025" / "10 May 2025" / "10-05-2025"
  const monthMap = {
    jan: 1, januari: 1,
    feb: 2, februari: 2,
    mar: 3, maret: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7,
    agu: 8, agustus: 8, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    okt: 10, october: 10, oct: 10, oktober: 10,
    nov: 11, november: 11,
    des: 12, desember: 12, dec: 12, december: 12
  };
  // Coba format "DD MM YYYY" atau "DD-MM-YYYY" atau "DD/MM/YYYY"
  const parts = s.split(/[\s\-\/.,]+/).filter(Boolean);
  if (parts.length >= 3) {
    let d = parseInt(parts[0], 10);
    let m = monthMap[parts[1].toLowerCase()];
    if (m == null) m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000; // 25 -> 2025
    if (!Number.isNaN(d) && !Number.isNaN(m) && m >= 1 && m <= 12 && !Number.isNaN(y)) {
      const mm = String(m).padStart(2, '0');
      const dd = String(Math.min(31, Math.max(1, d))).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
  return null;
}

function toInt(value) {
  if (value == null) return null;
  const s = String(value).replace(/[^0-9\-]/g, '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function toBool(cell) {
  if (!cell) return false;
  const s = String(cell).trim();
  if (!s) return false;
  if (/^(0|no|tidak|false)$/i.test(s)) return false;
  return true;
}

function truncate(str, maxLen) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function importFile(filePath, sortStart) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File tidak ditemukan: ${absPath}`);
    return 0;
  }
  const html = fs.readFileSync(absPath, 'utf8');

  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  if (trMatches.length === 0) {
    console.error(`Tidak ada <tr> di file: ${absPath}`);
    return 0;
  }

  const headerIndices = [];
  let header = null;
  for (let i = 0; i < trMatches.length; i += 1) {
    const cells = extractCells(trMatches[i]);
    const hasTntv = cells.some((c) => /tntv/i.test(c));
    const hasDfnt = cells.some((c) => /dfnt/i.test(c) || /d\/fnt/i.test(c));
    const hasClient = cells.some((c) => /client/i.test(c));
    if (hasTntv && hasDfnt && hasClient) {
      if (!header) header = cells;
      headerIndices.push(i);
    }
  }
  if (!header || headerIndices.length === 0) {
    console.error(`Header TNTV/DFNT/CLIENT tidak ditemukan di file: ${absPath}`);
    return 0;
  }
  if (headerIndices.length > 1) {
    console.log(`[${path.basename(absPath)}] Ditemukan ${headerIndices.length} segmen tabel (header berulang), semua akan diimport.`);
  }

  const colIndexOr = (...regexes) => {
    for (const r of regexes) {
      const i = header.findIndex((c) => r.test(String(c).trim()));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idxTntv = colIndexOr(/tntv/i);
  const idxDfnt = colIndexOr(/dfnt/i, /d\/fnt/i);
  const idxClient = colIndexOr(/client/i);
  const idxHotel = colIndexOr(/hotel\s*(mekkah|madinah)?/i, /^hotel$/i);
  const idxIn = colIndexOr(/^in\b/i, /check\s*in/i, /tanggal\s*in/i);
  const idxOut = colIndexOr(/^out\b/i, /check\s*out/i, /tanggal\s*out/i);
  const idxTotalHari = colIndexOr(/total\s*hari/i, /total\s*h/i, /lama/i);
  const idxD = colIndexOr(/^d$/i, /^\bd\b/i);
  const idxT = colIndexOr(/^t$/i, /^\bt\b/i);
  const idxQ = colIndexOr(/^q$/i, /^\bq\b/i);
  const idxQn = colIndexOr(/^qn$/i, /q\s*n/i);
  const idxHx = colIndexOr(/^hx$/i, /^\bhx\b/i);
  const idxRoom = colIndexOr(/room/i, /kamar/i);
  const idxPax = colIndexOr(/pax/i, /orang/i);
  const idxBB = colIndexOr(/^bb\b/i, /bed\s*breakfast/i);
  const idxFB = colIndexOr(/^fb\b/i, /full\s*board/i);
  const idxAvail = colIndexOr(/available/i, /avail/i);
  const idxBooked = colIndexOr(/booked/i);
  const idxAmend = colIndexOr(/amend/i);
  const idxLunas = colIndexOr(/lunas/i);
  const idxVoucher = colIndexOr(/voucher/i);
  const idxKet = colIndexOr(/keterangan/i, /ket\.?/i, /remark/i);
  const idxClerk = colIndexOr(/invoice\s*clerk/i, /clerk/i);

  const colMap = {
    TNTV: idxTntv, DFNT: idxDfnt, CLIENT: idxClient, HOTEL: idxHotel, IN: idxIn, OUT: idxOut,
    TOTAL_HARI: idxTotalHari, D: idxD, T: idxT, Q: idxQ, Qn: idxQn, Hx: idxHx, Room: idxRoom, Pax: idxPax,
    BB: idxBB, FB: idxFB, Available: idxAvail, Booked: idxBooked, Amend: idxAmend, LUNAS: idxLunas,
    Voucher: idxVoucher, Keterangan: idxKet, InvoiceClerk: idxClerk
  };
  console.log(`[${path.basename(absPath)}] Kolom terdeteksi:`, JSON.stringify(colMap));

  const baseName = path.basename(absPath).replace(/\.html?$/i, '');
  const periodName = baseName;
  const isMakkah = /makkah|mekkah/i.test(baseName);
  const isMadinah = /madinah/i.test(baseName);

  await RekapHotel.destroy({
    where: { source_type: 'order_list', period_name: periodName }
  });

  const rows = [];
  let sortOrder = sortStart;
  let skippedEmpty = 0;

  for (let seg = 0; seg < headerIndices.length; seg += 1) {
    const headerIndex = headerIndices[seg];
    const nextHeader = headerIndices[seg + 1];
    const endIndex = nextHeader != null ? nextHeader : trMatches.length;

    for (let i = headerIndex + 1; i < endIndex; i += 1) {
      const cells = extractCells(trMatches[i]);
      if (cells.length === 0) continue;
      const joined = cells.join(' ').trim();
      if (!joined) continue;

      const tentative = idxTntv >= 0 ? (cells[idxTntv] || '').trim() || null : null;
      const definite = idxDfnt >= 0 ? (cells[idxDfnt] || '').trim() || null : null;
      const client = idxClient >= 0 ? (cells[idxClient] || '').trim() || null : null;
      const checkInRaw = idxIn >= 0 ? cells[idxIn] || null : null;
      const checkOutRaw = idxOut >= 0 ? cells[idxOut] || null : null;
      const hotelVal = idxHotel >= 0 ? (cells[idxHotel] || '').trim() || null : null;
      const checkIn = parseDateId(checkInRaw);
      const checkOut = parseDateId(checkOutRaw);

      const hasAny = tentative || definite || client || hotelVal || checkIn || checkOut;
      if (!hasAny) {
        skippedEmpty += 1;
        continue;
      }

      rows.push({
        source_type: 'order_list',
        period_name: periodName,
        season_year: null,
        sort_order: sortOrder,
        tentative: truncate(tentative, 200),
        definite: truncate(definite, 200),
        client: truncate(client, 200),
        hotel_makkah: isMakkah ? truncate(hotelVal, 200) : null,
        hotel_madinah: isMadinah ? truncate(hotelVal, 200) : null,
        check_in: checkIn || null,
        check_out: checkOut || null,
        total_hari: idxTotalHari >= 0 ? toInt(cells[idxTotalHari]) : null,
        room_d: idxD >= 0 ? toInt(cells[idxD]) : null,
        room_t: idxT >= 0 ? toInt(cells[idxT]) : null,
        room_q: idxQ >= 0 ? toInt(cells[idxQ]) : null,
        room_qn: idxQn >= 0 ? toInt(cells[idxQn]) : null,
        room_hx: idxHx >= 0 ? toInt(cells[idxHx]) : null,
        room: idxRoom >= 0 ? toInt(cells[idxRoom]) : null,
        pax: idxPax >= 0 ? toInt(cells[idxPax]) : null,
        meal_bb: idxBB >= 0 ? toBool(cells[idxBB]) : false,
        meal_fb: idxFB >= 0 ? toBool(cells[idxFB]) : false,
        status_available: idxAvail >= 0 ? toBool(cells[idxAvail]) : false,
        status_booked: idxBooked >= 0 ? toBool(cells[idxBooked]) : false,
        status_amend: idxAmend >= 0 ? toBool(cells[idxAmend]) : false,
        status_lunas: idxLunas >= 0 ? toBool(cells[idxLunas]) : false,
        voucher: idxVoucher >= 0 ? truncate(cells[idxVoucher], 120) : null,
        keterangan: idxKet >= 0 ? truncate(cells[idxKet], 500) : null,
        invoice_clerk: idxClerk >= 0 ? truncate(cells[idxClerk], 120) : null
      });
      sortOrder += 1;
    }
  }

  if (skippedEmpty) console.warn(`  Baris dilewati (kosong): ${skippedEmpty}`);

  if (rows.length === 0) {
    console.warn(`Tidak ada baris data yang diimport dari ${absPath}`);
    return 0;
  }

  await RekapHotel.bulkCreate(rows);
  console.log(`Imported ${rows.length} baris dari ${absPath} (period_name=${periodName}).`);
  return rows.length;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/import-orderan-hotel-ledger.js <file1.html> [file2.html] ...');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    let sort = 1;
    let total = 0;
    for (const file of args) {
      const imported = await importFile(file, sort);
      sort += imported;
      total += imported;
    }
    console.log(`Selesai. Total baris diimport: ${total}.`);
    process.exit(0);
  } catch (e) {
    console.error('Import error:', e.message || e);
    process.exit(1);
  } finally {
    try {
      await sequelize.close();
    } catch (_) {
      // ignore
    }
  }
}

main();

