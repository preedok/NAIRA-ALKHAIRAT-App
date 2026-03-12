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

function decodeEntities(s) {
  if (!s) return s;
  return String(s)
    .replace(/&#x2713;/gi, '\u2713')
    .replace(/&#x2714;/gi, '\u2714')
    .replace(/&#9745;/g, '\u2713')
    .replace(/&check;|&#10003;/gi, '\u2713')
    .replace(/&nbsp;/gi, ' ');
}

function stripTags(html) {
  if (!html) return '';
  return decodeEntities(String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'))
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
  if (cell == null || cell === '') return false;
  const s = decodeEntities(String(cell)).replace(/\s+/g, ' ').trim();
  if (!s) return false;
  if (/^(0|no|n|tidak|false|\-|–)$/i.test(s)) return false;
  if (/^(1|yes|y|v|v\/|x|✓|✔|√|true|centang|ada)$/i.test(s)) return true;
  if (/&#x2713;|&#x2714;|&#9745;|&check;|&#10003;/i.test(s)) return true;
  return true; // sembarang isi lain dianggap true (centang)
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

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const colIndexInRow = (rowCells, ...regexes) => {
    for (const r of regexes) {
      const i = rowCells.findIndex((c) => r.test(norm(c)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const colIndexOr = (...regexes) => colIndexInRow(header, ...regexes);

  // Cari kolom di baris header atau 4 baris berikutnya (untuk tabel dengan subheader)
  const scanStart = headerIndices[0];
  const scanEnd = Math.min(scanStart + 5, trMatches.length);
  const findColInRange = (...regexes) => {
    for (let r = scanStart; r < scanEnd; r += 1) {
      const rowCells = extractCells(trMatches[r]);
      const i = colIndexInRow(rowCells, ...regexes);
      if (i >= 0) return i;
    }
    return -1;
  };
  const headerRow2 = scanStart + 1 < trMatches.length ? extractCells(trMatches[scanStart + 1]) : [];
  const pick = (idxFromRow1, ...regexesRow2) => {
    if (idxFromRow1 >= 0) return idxFromRow1;
    const fromRow2 = colIndexInRow(headerRow2, ...regexesRow2);
    if (fromRow2 >= 0) return fromRow2;
    return findColInRange(...regexesRow2);
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
  const idxBB = pick(colIndexOr(/^bb\b/i, /bed\s*breakfast/i), /^bb\b/i);
  const idxFB = pick(colIndexOr(/^fb\b/i, /full\s*board/i), /^fb\b/i);
  const idxAvail = pick(colIndexOr(/available/i, /avail/i), /available/i, /avail/i);
  const idxBooked = pick(colIndexOr(/booked/i), /booked/i);
  const idxAmend = pick(colIndexOr(/amend/i), /amend/i);
  const idxLunas = pick(colIndexOr(/lunas/i), /lunas/i);
  let idxVoucher = pick(colIndexOr(/voucher/i), /voucher/i);
  let idxKet = pick(
    colIndexOr(/keterangan/i, /^ket\b/i, /ket\./i, /remark/i, /catatan/i),
    /keterangan/i, /^ket\b/i, /remark/i, /catatan/i, /ket/i
  );
  let idxClerk = pick(
    colIndexOr(/invoice\s*clerk/i, /clerk/i, /petugas/i),
    /invoice\s*clerk/i, /clerk/i, /invoice/i, /petugas/i
  );
  // Fallback: kolom setelah Voucher = Keterangan, lalu Invoice Clerk (header sering kosong di export)
  if (idxVoucher < 0 && idxLunas >= 0) idxVoucher = idxLunas + 1;
  if (idxKet < 0 && idxVoucher >= 0) idxKet = idxVoucher + 1;
  if (idxClerk < 0 && idxKet >= 0) idxClerk = idxKet + 1;
  if (idxKet < 0) idxKet = 28;
  if (idxClerk < 0) idxClerk = 29;

  const colMap = {
    TNTV: idxTntv, DFNT: idxDfnt, CLIENT: idxClient, HOTEL: idxHotel, IN: idxIn, OUT: idxOut,
    TOTAL_HARI: idxTotalHari, D: idxD, T: idxT, Q: idxQ, Qn: idxQn, Hx: idxHx, Room: idxRoom, Pax: idxPax,
    BB: idxBB, FB: idxFB, Available: idxAvail, Booked: idxBooked, Amend: idxAmend, LUNAS: idxLunas,
    Voucher: idxVoucher, Keterangan: idxKet, InvoiceClerk: idxClerk
  };
  console.log(`[${path.basename(absPath)}] Kolom terdeteksi:`, JSON.stringify(colMap));
  if (idxKet < 0 || idxClerk < 0) {
    const headerPreview = header.slice(0, 35).map((c, i) => `${i}:${norm(c).slice(0, 15)}`).join(' ');
    console.log(`  Header (indeks:teks): ${headerPreview}`);
  }

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

      const getCell = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : null);
      const tentative = idxTntv >= 0 ? (getCell(idxTntv) || '').trim() || null : null;
      const definite = idxDfnt >= 0 ? (getCell(idxDfnt) || '').trim() || null : null;
      const client = idxClient >= 0 ? (getCell(idxClient) || '').trim() || null : null;
      const checkInRaw = getCell(idxIn);
      const checkOutRaw = getCell(idxOut);
      const hotelVal = idxHotel >= 0 ? (getCell(idxHotel) || '').trim() || null : null;
      const checkIn = parseDateId(checkInRaw);
      const checkOut = parseDateId(checkOutRaw);

      const numCols = [
        idxTotalHari, idxD, idxT, idxQ, idxQn, idxHx, idxRoom, idxPax
      ].map((idx) => (idx >= 0 ? (getCell(idx) || '').trim() : ''));
      const boolCols = [
        idxBB, idxFB, idxAvail, idxBooked, idxAmend, idxLunas
      ].map((idx) => (idx >= 0 ? (getCell(idx) || '').trim() : ''));
      const otherText = [
        idxVoucher >= 0 ? (getCell(idxVoucher) || '').trim() : '',
        idxKet >= 0 ? (getCell(idxKet) || '').trim() : '',
        idxClerk >= 0 ? (getCell(idxClerk) || '').trim() : ''
      ];

      const hasNumeric = numCols.some((v) => v !== '');
      const hasBool = boolCols.some((v) => v !== '');
      const hasOtherText = otherText.some((v) => v !== '');

      const hasAny = tentative || definite || client || hotelVal || checkIn || checkOut || hasNumeric || hasBool || hasOtherText;
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
        total_hari: idxTotalHari >= 0 ? toInt(getCell(idxTotalHari)) : null,
        room_d: idxD >= 0 ? toInt(getCell(idxD)) : null,
        room_t: idxT >= 0 ? toInt(getCell(idxT)) : null,
        room_q: idxQ >= 0 ? toInt(getCell(idxQ)) : null,
        room_qn: idxQn >= 0 ? toInt(getCell(idxQn)) : null,
        room_hx: idxHx >= 0 ? toInt(getCell(idxHx)) : null,
        room: idxRoom >= 0 ? toInt(getCell(idxRoom)) : null,
        pax: idxPax >= 0 ? toInt(getCell(idxPax)) : null,
        meal_bb: idxBB >= 0 ? toBool(getCell(idxBB)) : false,
        meal_fb: idxFB >= 0 ? toBool(getCell(idxFB)) : false,
        status_available: idxAvail >= 0 ? toBool(getCell(idxAvail)) : false,
        status_booked: idxBooked >= 0 ? toBool(getCell(idxBooked)) : false,
        status_amend: idxAmend >= 0 ? toBool(getCell(idxAmend)) : false,
        status_lunas: idxLunas >= 0 ? toBool(getCell(idxLunas)) : false,
        voucher: idxVoucher >= 0 ? truncate(getCell(idxVoucher), 120) : null,
        keterangan: idxKet >= 0 ? truncate(getCell(idxKet), 500) : null,
        invoice_clerk: idxClerk >= 0 ? truncate(getCell(idxClerk), 120) : null
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

