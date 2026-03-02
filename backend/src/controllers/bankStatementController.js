const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Fuse = require('fuse.js');
const { Op } = require('sequelize');
const { BankStatementUpload, BankStatementLine, PaymentProof, Invoice, User, ReconciliationLog } = require('../models');
const uploadsConfig = require('../config/uploads');
const pdfParse = require('pdf-parse');

/** Toleransi selisih hari untuk fuzzy match (efek kliring bank). */
const FUZZY_DATE_DAYS = 2;

/**
 * Ekstrak teks dari PDF digital (mis. Kopra) langsung tanpa OCR.
 * Untuk PDF dengan teks pilih (digital) hasil lebih akurat dan cepat.
 */
async function extractTextFromPdf(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  return (data && data.text) ? String(data.text).trim() : '';
}

const memoryStorage = multer.memoryStorage();
const uploadExcelOrPdf = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isExcel = /\.(xlsx|xls)$/i.test(name) || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel';
    const isPdf = /\.pdf$/i.test(name) || mime === 'application/pdf' || (mime === 'application/octet-stream' && name.endsWith('.pdf'));
    if (isExcel || isPdf) cb(null, true);
    else cb(new Error('Hanya file Excel (.xlsx, .xls) atau PDF (.pdf) yang diperbolehkan'));
  }
});

/**
 * Normalize header cell untuk deteksi kolom (case-insensitive, trim).
 */
const norm = (s) => (s && String(s).trim().toLowerCase()) || '';

/**
 * Cari indeks kolom dari baris header. Format umum rekening koran: Tanggal, Keterangan, No Ref, Debit, Kredit, Saldo.
 */
function detectColumns(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const raw = cell && (typeof cell === 'object' && (cell.text || cell.value));
    const v = norm(typeof raw === 'string' ? raw : (raw && String(raw)));
    if (!v) return;
    if (/tanggal|date|tgl/.test(v)) map.date = idx;
    else if (/keterangan|deskripsi|description|uraian/.test(v)) map.description = idx;
    else if (/ref|referensi|no\.?\s*ref|nomor/.test(v)) map.reference = idx;
    else if (/debit/.test(v)) map.debit = idx;
    else if (/kredit|credit/.test(v)) map.credit = idx;
    else if (/saldo/.test(v)) map.balance = idx;
  });
  return map;
}

/**
 * Parse nilai amount. Format Indonesia (15.094.874,49) vs Inggris (15,094,874.49).
 * Jika koma terakhir ada setelah titik terakhir = desimal koma (ID), else = ribuan koma (EN).
 */
function parseAmount(val) {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.abs(val);
  let s = String(val).replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = s.replace(/,/g, '.');
  } else if (lastDot !== -1) {
    if (s.match(/\.\d{3}\./)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Parse tanggal dari cell (Excel serial number atau string).
 */
const DATEONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    const d = ExcelJS.valueToDate(val);
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(val).trim();
  if (s.toLowerCase() === 'invalid date' || !s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) {
    if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

/** Pastikan string hanya format DATEONLY (YYYY-MM-DD) untuk kolom transaction_date. Tolak "Invalid date" dan objek Date invalid. */
function toDateOnly(s) {
  if (s == null) return null;
  let t;
  if (typeof s === 'string') {
    t = s.trim();
  } else if (s instanceof Date) {
    if (Number.isNaN(s.getTime())) return null;
    t = s.toISOString().slice(0, 10);
  } else {
    return null;
  }
  if (!t || /invalid\s*date/i.test(t)) return null;
  if (!DATEONLY_REGEX.test(t)) return null;
  const [y, m, d] = t.split('-').map(Number);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Batas aman DECIMAL(18,2): dalam rentang JS safe integer agar tidak rounding ke 17 digit. */
const MAX_DECIMAL_18_2 = 999999999999999.99;

/** Batas nominal wajar per transaksi (500 milyar). Nilai di atas ini (mis. saldo salah kolom) tidak dipakai untuk matching. */
const MAX_REASONABLE_AMOUNT = 500000000000;

/** Bulatkan ke 2 desimal dan clamp ke rentang DECIMAL(18,2). Nilai sangat besar dari parser di-clamp. */
function toDecimal2(n) {
  if (n == null) return 0;
  const num = Number(n);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  let v = num;
  if (Math.abs(num) > MAX_DECIMAL_18_2) return num > 0 ? MAX_DECIMAL_18_2 : -MAX_DECIMAL_18_2;
  v = Math.round(num * 100) / 100;
  if (v > MAX_DECIMAL_18_2) return MAX_DECIMAL_18_2;
  if (v < -MAX_DECIMAL_18_2) return -MAX_DECIMAL_18_2;
  return v;
}

/** Clamp amount dari parser: hindari saldo/kolom salah terbaca sebagai nominal transaksi. */
function clampReasonbleAmount(n) {
  if (n == null) return 0;
  const num = Number(n);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  if (num > MAX_REASONABLE_AMOUNT) return MAX_REASONABLE_AMOUNT;
  if (num < -MAX_REASONABLE_AMOUNT) return -MAX_REASONABLE_AMOUNT;
  return num;
}

/** Jika deskripsi seperti biaya/charge dan satu amount sangat besar (saldo salah kolom), nolkan yang besar. */
const FEE_DESC_REGEX = /CHARGE|FEE|BIAYA|ADMIN|MONTHLY\s+CARD|Pajak|Bunga/i;
const SMALL_AMOUNT_MAX = 100000;
const HUGE_AMOUNT_MIN = 1e9;
function correctFeeRowAmounts(description, amountDebit, amountCredit) {
  const desc = (description || '').trim();
  if (!FEE_DESC_REGEX.test(desc)) return { amountDebit, amountCredit };
  const d = Number(amountDebit);
  const c = Number(amountCredit);
  const big = Math.max(d, c);
  const small = Math.min(d, c);
  if (big >= HUGE_AMOUNT_MIN && small <= SMALL_AMOUNT_MAX) {
    if (d >= HUGE_AMOUNT_MIN) return { amountDebit: 0, amountCredit: c };
    if (c >= HUGE_AMOUNT_MIN) return { amountDebit: d, amountCredit: 0 };
  }
  return { amountDebit: d, amountCredit: c };
}

const MONTH_NAME_TO_NUM = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/**
 * Parse tanggal dari string saja (untuk PDF).
 * Format: DD/MM/YYYY, YYYY-MM-DD, atau "02 May 2025" / "02 May 2025, 12:28:40" (statement bank Inggris).
 */
function parseDateString(s) {
  if (!s || typeof s !== 'string') return null;
  let t = String(s).trim();
  t = t.replace(/\s*,\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/i, '').trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  const m = iso || dmy;
  if (m) {
    const y = m[1].length === 4 ? m[1] : m[3];
    const mo = m[1].length === 4 ? m[2] : m[2].padStart(2, '0');
    const d = m[1].length === 4 ? m[3] : m[1].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const en = t.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (en) {
    const mo = MONTH_NAME_TO_NUM[en[2].toLowerCase().slice(0, 3)];
    if (mo) return `${en[3]}-${mo}-${en[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Cek apakah baris terlihat seperti header tabel (bukan data transaksi).
 * Termasuk header Indonesia dan Inggris (Account Statement, Posting Date, Credit, Debit, Balance, dll).
 */
function isPdfHeaderLine(line) {
  const lower = line.toLowerCase().trim();
  const idHeader = /^(tanggal|date|tgl)\s/i.test(lower) || /^(no\.?\s*ref|keterangan|debit|kredit|saldo)\s/i.test(lower);
  const enHeader = /^(account\s+statement|posting\s+date|opening\s+balance|closing\s+balance|total\s+amount|credit\s|debit\s|balance\s|reference\s|remark\s|account\s+no|period\s|created\s|summary|account\s+name|alias\s|currency\s|branch\s|no\.\s*of\s)/i.test(lower);
  return line.length < 120 && (idHeader || enHeader);
}

/** Regex: tiga token angka di akhir baris (Debit, Credit, Balance). */
const LAST_THREE_AMOUNTS_REGEX = /\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s*$/;
/** Regex: kemunculan tiga token angka (tanpa harus di akhir) - untuk fallback saat PDF memotong baris. */
const THREE_AMOUNTS_REGEX = /\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s+(\d[\d.,]*)/g;

/**
 * Regex untuk satu nilai amount penuh (format EN: 10,000.00 atau ID: 10.000.000,00; termasuk 0.00/0,00).
 * Dipakai untuk teks yang menggabungkan Debit/Credit/Saldo tanpa spasi (mis. -293,000,000.000.00339,292,374.49).
 */
const ONE_AMOUNT_REGEX = /-?(?:\d{1,3}(?:,\d{3})*\.\d{2}|\d{1,3}(?:\.\d{3})*,\d{2}|0\.\d{2}|0,\d{2})/g;

/**
 * Ekstrak 3 amount terakhir dari teks (Debit, Credit, Balance) dengan regex amount penuh.
 * Berguna saat kolom digabung tanpa spasi (contoh: -293,000,000.000.00339,292,374.49).
 */
function extractLastThreeAmountsFromText(row) {
  const matches = row.match(ONE_AMOUNT_REGEX);
  if (!matches || matches.length < 3) return null;
  const three = matches.slice(-3);
  const a = parseAmount(three[0]);
  const b = parseAmount(three[1]);
  const c = parseAmount(three[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  if (c > MAX_REASONABLE_AMOUNT) return null;
  return { amountDebit: a, amountCredit: b, balanceAfter: c };
}

/**
 * Ambil kemunculan terakhir tiga angka (Debit, Credit, Balance) di teks. Abaikan jika ketiganya kecil (seperti nomor ref).
 * Coba dulu pola spasi, lalu pola amount penuh (untuk teks gabungan tanpa spasi).
 */
function findLastThreeAmounts(row) {
  let atEnd = row.match(LAST_THREE_AMOUNTS_REGEX);
  if (atEnd) return atEnd;
  let last;
  THREE_AMOUNTS_REGEX.lastIndex = 0;
  let m;
  while ((m = THREE_AMOUNTS_REGEX.exec(row)) !== null) last = m;
  if (last) {
    const a = parseAmount(last[1]);
    const b = parseAmount(last[2]);
    const c = parseAmount(last[3]);
    if (!(a < 10000 && b < 10000 && c < 10000 && (a > 0 || b > 0 || c > 0))) return last;
  }
  const triple = extractLastThreeAmountsFromText(row);
  if (triple) return [null, String(triple.amountDebit), String(triple.amountCredit), String(triple.balanceAfter)];
  return null;
}

/**
 * Fallback: ambil 3 angka terakhir di row yang "amount-like" (0 atau >= 1000), urutan = Debit, Credit, Balance.
 * Abaikan angka yang mirip tahun (2020-2030) agar tidak salah baca sebagai amount.
 */
function lastThreeAmountLikeFromAllNumbers(row) {
  const numRegex = /\d[\d.,]*/g;
  const nums = [];
  let match;
  while ((match = numRegex.exec(row)) !== null) {
    const n = parseAmount(match[0]);
    if (n >= 2020 && n <= 2030) continue;
    nums.push(n);
  }
  const amountLike = [];
  for (let k = nums.length - 1; k >= 0 && amountLike.length < 3; k--) {
    const n = nums[k];
    if (n === 0 || (n >= 1000 && !(n >= 2020 && n <= 2030))) amountLike.unshift(n);
  }
  if (amountLike.length !== 3) return null;
  const [debit, credit, balance] = amountLike;
  if (balance < 10000 && debit !== 0 && credit !== 0) return null;
  return { debit, credit, balance };
}

/**
 * Ekstrak baris transaksi dengan memecah teks menurut pola tanggal (untuk PDF fragmen).
 * Urutan kolom: Posting Date | Remark | Reference No. | Debit | Credit | Balance.
 * Jika tiga amount tidak di akhir segment (PDF memotong baris), gabung dengan segment berikutnya atau ambil kemunculan terakhir tiga angka.
 */
function parsePdfBankStatementByDateChunks(raw) {
  const result = [];
  const dateStartRegex = /(?=\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}(?:\s*,\s*\d{1,2}:\d{2}:\d{2})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi;
  const segments = raw.split(dateStartRegex).map((s) => s.trim()).filter(Boolean);
  const startsWithDate = (s) => /^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i.test(s) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(s);

  for (let i = 0; i < segments.length; i++) {
    let row = segments[i];
    let dateMatch = row.match(/^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}(?:\s*,\s*\d{1,2}:\d{2}:\d{2})?)/i);
    if (!dateMatch) dateMatch = row.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
    if (!dateMatch) continue;
    if (/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*-\s*\d{1,2}/i.test(row)) continue;
    const transactionDate = parseDateString(dateMatch[1].trim());
    if (!transactionDate) continue;
    const rowLower = row.toLowerCase();
    if (/account\s+statement\s+summary|opening\s+balance|closing\s+balance|total\s+amount\s+(debited|credited)|no\.?\s*of\s+(debit|credit)\s*\d|account\s+no\.?\s*account\s+name/i.test(rowLower)) continue;

    let amountsMatch = row.match(LAST_THREE_AMOUNTS_REGEX);
    let nextSegmentIndex = i;
    if (!amountsMatch) {
      let j = i + 1;
      while (!amountsMatch && j < segments.length && !startsWithDate(segments[j])) {
        row = row + ' ' + segments[j];
        amountsMatch = row.match(LAST_THREE_AMOUNTS_REGEX);
        nextSegmentIndex = j;
        j++;
      }
      if (!amountsMatch) amountsMatch = findLastThreeAmounts(row);
    }
    if (amountsMatch && nextSegmentIndex > i) i = nextSegmentIndex;

    let amountDebit;
    let amountCredit;
    let balanceAfter;
    if (amountsMatch && amountsMatch[1] !== undefined) {
      amountDebit = parseAmount(amountsMatch[1]);
      amountCredit = parseAmount(amountsMatch[2]);
      balanceAfter = parseAmount(amountsMatch[3]);
    } else {
      const triple = lastThreeAmountLikeFromAllNumbers(row);
      if (!triple) continue;
      amountDebit = triple.debit;
      amountCredit = triple.credit;
      balanceAfter = triple.balance;
    }
    let description = row.slice(dateMatch[0].length).trim();
    description = description.replace(/\s+\d[\d.,]*\s+\d[\d.,]*\s+\d[\d.,]*\s*$/, '').trim();
    const refMatch = description.match(/\b(\d{4,}(?:,\d{3,})*)\b/);
    const referenceNumber = refMatch ? refMatch[1].slice(0, 100) : null;
    const corrected = correctFeeRowAmounts(description, amountDebit, amountCredit);
    amountDebit = corrected.amountDebit;
    amountCredit = corrected.amountCredit;
    amountDebit = clampReasonbleAmount(amountDebit);
    amountCredit = clampReasonbleAmount(amountCredit);
    if (balanceAfter != null) balanceAfter = clampReasonbleAmount(balanceAfter);
    const amount = amountCredit > 0 ? amountCredit : -amountDebit;
    result.push({
      transaction_date: transactionDate,
      description: description.slice(0, 2000) || null,
      reference_number: referenceNumber,
      amount_debit: amountDebit,
      amount_credit: amountCredit,
      amount,
      balance_after: balanceAfter
    });
  }
  return result;
}

/**
 * Ekstrak baris transaksi dari teks PDF rekening koran.
 * Urutan kolom: Posting Date (Tanggal) | Remark (Keterangan) | Reference No. | Debit | Credit | Balance.
 * Mendukung: pemisah 2+ spasi (6 kolom), pemisah 1 spasi, atau regex tanggal + 3 angka (Debit, Credit, Balance).
 */
function parsePdfBankStatement(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (raw.includes('\n\n') || lines.length > 15) {
    const chunkResult = parsePdfBankStatementByDateChunks(raw);
    if (chunkResult.length > 0) return chunkResult;
  }
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isPdfHeaderLine(line)) continue;

    const parts = line.split(/\s{2,}/).filter(Boolean);
    const partsBySpace1 = line.split(/\s+/).filter(Boolean);
    let transactionDate = null;
    let description = null;
    let referenceNumber = null;
    let amountDebit = 0;
    let amountCredit = 0;
    let balanceAfter = null;

    if (parts.length >= 6) {
      transactionDate = parseDateString(parts[0]);
      if (!transactionDate) continue;
      description = (parts[1] != null ? String(parts[1]).trim().slice(0, 2000) : null) || null;
      referenceNumber = (parts[2] != null ? String(parts[2]).trim().slice(0, 100) : null) || null;
      amountDebit = clampReasonbleAmount(parseAmount(parts[3]));
      amountCredit = clampReasonbleAmount(parseAmount(parts[4]));
      balanceAfter = parseAmount(parts[5]);
      balanceAfter = balanceAfter != null ? clampReasonbleAmount(balanceAfter) : null;
    } else if (parts.length === 5) {
      transactionDate = parseDateString(parts[0]);
      if (!transactionDate) continue;
      description = (parts[1] != null ? String(parts[1]).trim().slice(0, 2000) : null) || null;
      referenceNumber = null;
      amountDebit = clampReasonbleAmount(parseAmount(parts[2]));
      amountCredit = clampReasonbleAmount(parseAmount(parts[3]));
      balanceAfter = parseAmount(parts[4]);
      balanceAfter = balanceAfter != null ? clampReasonbleAmount(balanceAfter) : null;
    } else if (partsBySpace1.length >= 6) {
      const first = partsBySpace1[0];
      let dateStr = first;
      if (!parseDateString(first) && partsBySpace1.length >= 3 && /^\d{1,2}$/.test(first) && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(partsBySpace1[1])) {
        dateStr = `${first} ${partsBySpace1[1]} ${(partsBySpace1[2] || '').replace(/,/g, '')}`;
      }
      const last3 = partsBySpace1.slice(-3);
      const last3AreNums = last3.every((p) => /^\d[\d.,]*$/.test(String(p).trim()));
      if (parseDateString(dateStr) && last3AreNums) {
        transactionDate = parseDateString(dateStr);
        amountDebit = clampReasonbleAmount(parseAmount(last3[0]));
        amountCredit = clampReasonbleAmount(parseAmount(last3[1]));
        balanceAfter = parseAmount(last3[2]);
        balanceAfter = balanceAfter != null ? clampReasonbleAmount(balanceAfter) : null;
        const mid = partsBySpace1.slice(1, -3);
        if (dateStr !== first) {
          const dateTokenCount = dateStr.split(/\s+/).length;
          for (let j = 0; j < dateTokenCount - 1 && mid.length; j++) mid.shift();
        }
        if (mid.length >= 1 && mid[mid.length - 1].length <= 30 && /^[A-Za-z0-9\-_]+$/.test(mid[mid.length - 1])) {
          referenceNumber = mid.pop();
          description = mid.join(' ').trim().slice(0, 2000) || null;
        } else {
          description = mid.join(' ').trim().slice(0, 2000) || null;
        }
      }
    }

    if (!transactionDate) {
      let dateMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
      if (!dateMatch) dateMatch = line.match(/^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}(?:\s*,\s*\d{1,2}:\d{2}:\d{2})?)/i);
      if (!dateMatch) continue;
      transactionDate = parseDateString(dateMatch[1].trim());
      if (!transactionDate) continue;
      const amountsMatch = line.match(LAST_THREE_AMOUNTS_REGEX);
      if (!amountsMatch) continue;
      amountDebit = parseAmount(amountsMatch[1]);
      amountCredit = parseAmount(amountsMatch[2]);
      balanceAfter = parseAmount(amountsMatch[3]);
      const afterDate = line.slice(dateMatch[0].length).trim();
      description = afterDate.replace(/\s+\d[\d.,]*\s+\d[\d.,]*\s+\d[\d.,]*\s*$/, '').trim().slice(0, 2000) || null;
    }

    const corrected = correctFeeRowAmounts(description, amountDebit, amountCredit);
    amountDebit = corrected.amountDebit;
    amountCredit = corrected.amountCredit;
    amountDebit = clampReasonbleAmount(amountDebit);
    amountCredit = clampReasonbleAmount(amountCredit);
    if (balanceAfter != null) balanceAfter = clampReasonbleAmount(balanceAfter);
    const amount = amountCredit > 0 ? amountCredit : -amountDebit;
    result.push({
      transaction_date: transactionDate,
      description: description || null,
      reference_number: referenceNumber && referenceNumber.length <= 100 ? referenceNumber : null,
      amount_debit: amountDebit,
      amount_credit: amountCredit,
      amount,
      balance_after: balanceAfter
    });
  }
  if (result.length === 0) return parsePdfBankStatementByDateChunks(raw);
  return result;
}

/**
 * POST /api/v1/accounting/bank-statements/upload
 * Upload file Excel atau PDF rekening koran; parse dan simpan ke bank_statement_uploads + bank_statement_lines.
 * Body (form): file (required), name (optional), period_from, period_to (optional).
 */
const uploadBankStatement = [
  uploadExcelOrPdf.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File wajib diunggah (Excel atau PDF)' });
    }
    const name = (req.body.name && String(req.body.name).trim()) || `Rekening Koran ${new Date().toLocaleDateString('id-ID')}`;
    const periodFrom = req.body.period_from && String(req.body.period_from).trim() ? String(req.body.period_from).trim() : null;
    const periodTo = req.body.period_to && String(req.body.period_to).trim() ? String(req.body.period_to).trim() : null;

    const isPdf = /\.pdf$/i.test(req.file.originalname) || (req.file.mimetype || '').includes('pdf');
    const isExcel = /\.(xlsx|xls)$/i.test(req.file.originalname) || (req.file.mimetype || '').includes('spreadsheet') || (req.file.mimetype || '').includes('ms-excel');
    let parsedLines = [];

    if (!isPdf && !isExcel) {
      return res.status(400).json({
        success: false,
        message: 'Hanya file Excel (.xlsx, .xls) atau PDF (.pdf) yang dapat diproses.'
      });
    }
    if (isPdf) {
      let text = '';
      try {
        text = await extractTextFromPdf(req.file.buffer);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Ekstraksi teks PDF gagal: ' + (err.message || String(err))
        });
      }
      text = text ? String(text).trim() : '';
      parsedLines = parsePdfBankStatement(text);
      if (parsedLines.length === 0) {
        const preview = text.slice(0, 500).replace(/\s+/g, ' ');
        return res.status(400).json({
          success: false,
          message: 'Tidak ada baris transaksi valid ditemukan dari PDF. Pastikan file PDF digital (mis. Kopra) berisi kolom: Tanggal, Keterangan, No Ref, Debit, Kredit, Saldo.',
          debug: { textLength: text.length, lineCount: text.split(/\n/).filter(Boolean).length, preview }
        });
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ success: false, message: 'Sheet pertama kosong atau tidak valid' });

      const rows = [];
      sheet.eachRow((row, rowNumber) => { rows.push({ rowNumber, cells: row.values }); });
      if (rows.length < 2) return res.status(400).json({ success: false, message: 'File harus berisi header dan minimal satu baris data' });

      const headerRow = rows[0].cells || [];
      const colMap = detectColumns(headerRow);
      const dateCol = colMap.date ?? 1;
      const descCol = colMap.description ?? 2;
      const refCol = colMap.reference ?? 3;
      const debitCol = colMap.debit ?? 4;
      const creditCol = colMap.credit ?? 5;
      const balanceCol = colMap.balance ?? 6;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i].cells || [];
        const rawDate = r[dateCol];
        const transactionDate = parseDate(rawDate);
        if (!transactionDate) continue;

        const debitVal = parseAmount(r[debitCol]);
        const creditVal = parseAmount(r[creditCol]);
        const amount = creditVal > 0 ? creditVal : -debitVal;
        const balanceAfter = balanceCol != null && r[balanceCol] != null ? parseAmount(r[balanceCol]) : null;

        parsedLines.push({
          transaction_date: transactionDate,
          description: r[descCol] != null ? String(r[descCol]).trim().slice(0, 2000) : null,
          reference_number: r[refCol] != null ? String(r[refCol]).trim().slice(0, 100) : null,
          amount_debit: debitVal,
          amount_credit: creditVal,
          amount,
          balance_after: balanceAfter
        });
      }
      if (parsedLines.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada baris transaksi valid (tanggal + debit/kredit) ditemukan di file' });
      }
    }

    const upload = await BankStatementUpload.create({
      name,
      period_from: periodFrom,
      period_to: periodTo,
      file_name: req.file.originalname,
      uploaded_by: req.user.id
    });

    // Simpan file asli untuk referensi/audit; rekon bisa pakai data ter-parse atau nanti ML.
    const ext = path.extname(req.file.originalname) || (isPdf ? '.pdf' : '.xlsx');
    const subdir = uploadsConfig.SUBDIRS.BANK_STATEMENTS;
    const dir = uploadsConfig.getDir(subdir);
    const savedFileName = `${upload.id}${ext}`;
    const absolutePath = path.join(dir, savedFileName);
    try {
      fs.writeFileSync(absolutePath, req.file.buffer);
      await upload.update({ original_file_path: `${subdir}/${savedFileName}` });
    } catch (err) {
      // Jika simpan file gagal, hapus record upload
      await upload.destroy();
      return res.status(500).json({ success: false, message: 'Gagal menyimpan file asli: ' + (err.message || 'unknown') });
    }

    let periodMin = periodFrom;
    let periodMax = periodTo;
    const lines = [];
    for (let i = 0; i < parsedLines.length; i++) {
      const p = parsedLines[i];
      const transactionDate = toDateOnly(p.transaction_date);
      if (!transactionDate) continue;
      if (!periodMin || transactionDate < periodMin) periodMin = transactionDate;
      if (!periodMax || transactionDate > periodMax) periodMax = transactionDate;
      lines.push({
        upload_id: upload.id,
        transaction_date: transactionDate,
        description: p.description != null ? String(p.description).trim().slice(0, 2000) : null,
        reference_number: p.reference_number != null ? String(p.reference_number).trim().slice(0, 100) : null,
        amount_debit: toDecimal2(p.amount_debit),
        amount_credit: toDecimal2(p.amount_credit),
        amount: toDecimal2(p.amount),
        balance_after: p.balance_after != null ? toDecimal2(p.balance_after) : null,
        row_index: i + 1,
        reconciliation_status: 'unreconciled'
      });
    }

    if (lines.length === 0) {
      if (upload.original_file_path) {
        try {
          const p = path.join(uploadsConfig.UPLOAD_ROOT, upload.original_file_path);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (_) { /* ignore */ }
      }
      await upload.destroy();
      return res.status(400).json({ success: false, message: 'Tidak ada baris dengan tanggal valid untuk disimpan.' });
    }

    const safeLines = lines
      .map((l) => ({ ...l, transaction_date: toDateOnly(l.transaction_date) }))
      .filter((l) => l.transaction_date != null);
    if (safeLines.length === 0) {
      if (upload.original_file_path) {
        try {
          const p = path.join(uploadsConfig.UPLOAD_ROOT, upload.original_file_path);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (_) { /* ignore */ }
      }
      await upload.destroy();
      return res.status(400).json({ success: false, message: 'Tidak ada baris dengan tanggal valid untuk disimpan.' });
    }
    await BankStatementLine.bulkCreate(safeLines);
    if (!upload.period_from && periodMin) await upload.update({ period_from: periodMin });
    if (!upload.period_to && periodMax) await upload.update({ period_to: periodMax });

    const withLines = await BankStatementUpload.findByPk(upload.id, {
      include: [{ model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }]
    });
    res.status(201).json({
      success: true,
      data: withLines,
      message: `${safeLines.length} baris rekening koran berhasil diimpor.`
    });
  })
];

/**
 * GET /api/v1/accounting/bank-statements
 * Daftar upload rekening koran (terbaru dulu).
 */
const listBankStatements = asyncHandler(async (req, res) => {
  const uploads = await BankStatementUpload.findAll({
    order: [['created_at', 'DESC']],
    include: [
      { model: User, as: 'UploadedBy', attributes: ['id', 'name'] },
      { model: BankStatementLine, as: 'Lines', attributes: ['id'], required: false }
    ]
  });
  const list = uploads.map((u) => {
    const plain = u.get ? u.get({ plain: true }) : u;
    const lineCount = (plain.Lines || []).length;
    delete plain.Lines;
    return { ...plain, line_count: lineCount };
  });
  res.json({ success: true, data: list });
});

/**
 * GET /api/v1/accounting/bank-statements/:id
 * Satu upload beserta baris-barisnya.
 */
const getBankStatement = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [
      { model: User, as: 'UploadedBy', attributes: ['id', 'name'] },
      { model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }
    ]
  });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  res.json({ success: true, data: upload });
});

/**
 * GET /api/v1/accounting/bank-statements/:id/original-file
 * Unduh file asli yang diunggah (PDF/Excel) untuk referensi dan verifikasi manual.
 */
const getOriginalFile = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, { attributes: ['id', 'file_name', 'original_file_path'] });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  if (!upload.original_file_path) return res.status(404).json({ success: false, message: 'File asli tidak tersedia untuk upload ini' });
  const absolutePath = path.join(uploadsConfig.UPLOAD_ROOT, upload.original_file_path);
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ success: false, message: 'File asli tidak ditemukan di server' });
  const filename = upload.file_name || path.basename(upload.original_file_path);
  const inline = req.query.inline === '1' || req.query.inline === 'true';
  if (inline) {
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '\\"')}"`);
    res.sendFile(absolutePath);
  } else {
    res.download(absolutePath, filename);
  }
});

/**
 * Mesin pencocokan: Exact (nominal + tanggal sama), Fuzzy (nominal sama, tanggal selisih 1–2 hari + Fuse.js pada keterangan).
 * Hanya mengupdate baris yang belum punya matched_payment_proof_id (belum di-approve/manual).
 */
async function runMatchingEngine(upload, bankLines, payments) {
  const round = (n) => Math.round(Number(n) * 100) / 100;
  const creditLines = bankLines.filter((l) => {
    const a = Number(l.amount);
    return a > 0 && a <= MAX_REASONABLE_AMOUNT;
  });
  const usedLineIds = new Set();
  const usedPaymentIds = new Set();

  const paymentList = payments.map((p) => {
    const plain = p.get ? p.get({ plain: true }) : p;
    const searchText = [plain.bank_name, plain.account_number, plain.Invoice?.invoice_number, plain.Invoice?.User?.name, plain.Invoice?.User?.company_name].filter(Boolean).join(' ');
    return { ...plain, _searchText: searchText || '' };
  });

  const fuse = new Fuse(paymentList, {
    keys: ['_searchText', 'invoice_number'],
    threshold: 0.4,
    includeScore: true
  });

  // 1) Exact: nominal + tanggal sama persis
  for (const p of payments) {
    const amt = round(p.amount);
    const date = p.transfer_date;
    const line = creditLines.find((b) => {
      if (usedLineIds.has(b.id) || b.matched_payment_proof_id) return false;
      return round(b.amount) === amt && b.transaction_date === date;
    });
    if (line) {
      usedLineIds.add(line.id);
      usedPaymentIds.add(p.id);
      await line.update({
        reconciliation_status: 'matched',
        matched_payment_proof_id: p.id,
        match_type: 'exact'
      });
    }
  }

  // 2) Fuzzy: nominal sama, tanggal dalam FUZZY_DATE_DAYS, Fuse pada keterangan vs catatan sistem
  for (const line of creditLines) {
    if (usedLineIds.has(line.id) || line.matched_payment_proof_id) continue;
    const lineAmt = round(line.amount);
    const lineDate = line.transaction_date;
    const desc = (line.description || '').trim();
    const candidates = paymentList.filter((p) => {
      if (usedPaymentIds.has(p.id)) return false;
      if (round(p.amount) !== lineAmt) return false;
      const d = new Date(p.transfer_date);
      const ld = new Date(lineDate);
      const diffDays = Math.abs((d - ld) / (24 * 60 * 60 * 1000));
      return diffDays <= FUZZY_DATE_DAYS;
    });
    if (candidates.length === 0) {
      await line.update({ reconciliation_status: 'unmatched', matched_payment_proof_id: null, match_type: null });
      continue;
    }
    const searchText = desc || lineAmt.toString();
    const results = fuse.search(searchText);
    const best = results.find((r) => candidates.some((c) => c.id === r.item.id));
    const chosen = best ? best.item : candidates[0];
    if (chosen) {
      usedLineIds.add(line.id);
      usedPaymentIds.add(chosen.id);
      await line.update({
        reconciliation_status: 'suggested',
        matched_payment_proof_id: chosen.id,
        match_type: 'fuzzy'
      });
    } else {
      await line.update({ reconciliation_status: 'unmatched', matched_payment_proof_id: null, match_type: null });
    }
  }

  // 3) Sisa baris kredit tanpa pasangan -> unmatched
  for (const line of creditLines) {
    if (usedLineIds.has(line.id) || line.matched_payment_proof_id) continue;
    await line.update({ reconciliation_status: 'unmatched', matched_payment_proof_id: null, match_type: null });
  }

  // Debit-only (amount <= 0) atau nominal tidak wajar (amount > MAX) -> unmatched
  for (const line of bankLines) {
    const a = Number(line.amount);
    if ((a <= 0 || a > MAX_REASONABLE_AMOUNT) && !line.reconciliation_status) {
      await line.update({ reconciliation_status: 'unmatched' });
    }
  }
}

/**
 * GET /api/v1/accounting/bank-statements/:id/reconcile
 * Workflow rekonsiliasi: tampilkan matched (hijau), suggested (kuning), unmatched (merah).
 * Jika upload belum finalize, jalankan matching engine (exact + fuzzy) lalu kembalikan view.
 */
const getReconciliation = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [
      { model: User, as: 'UploadedBy', attributes: ['id', 'name'] },
      { model: User, as: 'FinalizedBy', attributes: ['id', 'name'] },
      { model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']], include: [{ model: PaymentProof, as: 'MatchedPaymentProof', required: false, include: [{ model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }] }] }
    ]
  });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });

  const periodFrom = upload.period_from || (upload.Lines && upload.Lines[0] && upload.Lines[0].transaction_date);
  const periodTo = upload.period_to || (upload.Lines && upload.Lines.length && upload.Lines[upload.Lines.length - 1].transaction_date);

  const payments = await PaymentProof.findAll({
    where: {
      verified_at: { [Op.ne]: null },
      verified_status: 'verified',
      transfer_date: periodFrom && periodTo ? { [Op.between]: [periodFrom, periodTo] } : undefined
    },
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'total_amount'], include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }
    ],
    order: [['transfer_date', 'ASC'], ['created_at', 'ASC']]
  });

  if (!upload.finalized_at) {
    await runMatchingEngine(upload, upload.Lines || [], payments);
    await upload.reload({
      include: [
        { model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']], include: [{ model: PaymentProof, as: 'MatchedPaymentProof', required: false, include: [{ model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }] }] }
      ]
    });
  }

  const bankLines = (upload.Lines || []).map((l) => {
    const plain = l.get ? l.get({ plain: true }) : l;
    const pp = plain.MatchedPaymentProof;
    if (pp) {
      plain.suggestedMatch = {
        id: pp.id,
        transfer_date: pp.transfer_date,
        amount: parseFloat(pp.amount),
        invoice_number: pp.Invoice?.invoice_number,
        payer: pp.Invoice?.User?.name || pp.Invoice?.User?.company_name
      };
    }
    delete plain.MatchedPaymentProof;
    return plain;
  });

  const recorded = payments.map((p) => ({
    id: p.id,
    transfer_date: p.transfer_date,
    amount: parseFloat(p.amount),
    bank_name: p.bank_name,
    account_number: p.account_number,
    invoice_number: p.Invoice?.invoice_number,
    payer: p.Invoice?.User?.name || p.Invoice?.User?.company_name,
    payment_type: p.payment_type
  }));

  const matched = bankLines.filter((l) => l.reconciliation_status === 'matched' && l.suggestedMatch);
  const suggested = bankLines.filter((l) => l.reconciliation_status === 'suggested' && l.suggestedMatch);
  const unmatched = bankLines.filter((l) => l.reconciliation_status === 'unmatched' || !l.reconciliation_status);
  const usedPaymentIds = new Set(matched.concat(suggested).map((l) => l.matched_payment_proof_id).filter(Boolean));
  const onlyInRecorded = recorded.filter((r) => !usedPaymentIds.has(r.id));
  const onlyInBank = unmatched;

  res.json({
    success: true,
    data: {
      upload: upload.get ? upload.get({ plain: true }) : upload,
      systemTransactions: recorded,
      bankLines,
      matched,
      suggested,
      unmatched,
      onlyInRecorded,
      onlyInBank
    }
  });
});

/**
 * POST /api/v1/accounting/bank-statements/:id/reconcile/approve
 * Approve suggested match: ubah status baris dari suggested -> matched (user konfirmasi fuzzy match).
 */
const approveSuggested = asyncHandler(async (req, res) => {
  const { id: uploadId } = req.params;
  const { bank_line_id } = req.body || {};
  if (!bank_line_id) return res.status(400).json({ success: false, message: 'bank_line_id wajib' });
  const upload = await BankStatementUpload.findByPk(uploadId);
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  if (upload.finalized_at) return res.status(400).json({ success: false, message: 'Rekonsiliasi sudah difinalisasi' });
  const line = await BankStatementLine.findOne({ where: { id: bank_line_id, upload_id: uploadId } });
  if (!line) return res.status(404).json({ success: false, message: 'Baris bank tidak ditemukan' });
  if (line.reconciliation_status !== 'suggested' || !line.matched_payment_proof_id) return res.status(400).json({ success: false, message: 'Hanya baris dengan status suggested yang bisa di-approve' });
  await line.update({ reconciliation_status: 'matched' });
  res.json({ success: true, data: line, message: 'Saran cocok telah disetujui' });
});

/**
 * POST /api/v1/accounting/bank-statements/:id/reconcile/manual-map
 * Manual mapping: pasangkan baris bank dengan transaksi sistem (payment proof).
 */
const manualMap = asyncHandler(async (req, res) => {
  const { id: uploadId } = req.params;
  const { bank_line_id, payment_proof_id } = req.body || {};
  if (!bank_line_id || !payment_proof_id) return res.status(400).json({ success: false, message: 'bank_line_id dan payment_proof_id wajib' });
  const upload = await BankStatementUpload.findByPk(uploadId);
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  if (upload.finalized_at) return res.status(400).json({ success: false, message: 'Rekonsiliasi sudah difinalisasi' });
  const line = await BankStatementLine.findOne({ where: { id: bank_line_id, upload_id: uploadId } });
  if (!line) return res.status(404).json({ success: false, message: 'Baris bank tidak ditemukan' });
  const proof = await PaymentProof.findByPk(payment_proof_id);
  if (!proof || !proof.verified_at || proof.verified_status !== 'verified') return res.status(400).json({ success: false, message: 'Bukti pembayaran tidak valid atau belum terverifikasi' });
  await line.update({
    reconciliation_status: 'matched',
    matched_payment_proof_id: payment_proof_id,
    match_type: 'manual'
  });
  res.json({ success: true, data: line, message: 'Pemetaan manual berhasil' });
});

/**
 * POST /api/v1/accounting/bank-statements/:id/reconcile/finalize
 * Finalize: tulis reconciliation_logs, set finalized_at pada upload, reconciled_at pada baris.
 */
const finalizeReconciliation = asyncHandler(async (req, res) => {
  const { id: uploadId } = req.params;
  const upload = await BankStatementUpload.findByPk(uploadId, {
    include: [{ model: BankStatementLine, as: 'Lines', required: false, where: { matched_payment_proof_id: { [Op.ne]: null } } }]
  });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  if (upload.finalized_at) return res.status(400).json({ success: false, message: 'Rekonsiliasi sudah difinalisasi' });
  const linesToLog = upload.Lines || [];
  const now = new Date();
  for (const line of linesToLog) {
    await ReconciliationLog.create({
      upload_id: uploadId,
      bank_statement_line_id: line.id,
      payment_proof_id: line.matched_payment_proof_id,
      match_type: line.match_type || 'manual',
      matched_by: req.user.id,
      matched_at: now
    });
    await line.update({ reconciled_at: now, reconciled_by: req.user.id });
  }
  await upload.update({ finalized_at: now, finalized_by: req.user.id });
  res.json({
    success: true,
    message: `Rekonsiliasi difinalisasi. ${linesToLog.length} pasangan dicatat.`,
    data: { finalized_at: upload.finalized_at, pairs_count: linesToLog.length }
  });
});

/**
 * GET /api/v1/accounting/bank-statements/template
 * Download template Excel rekening koran (kolom: Tanggal, Keterangan, No Ref, Debit, Kredit, Saldo).
 */
const downloadTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekening Koran', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = ['Tanggal', 'Keterangan', 'No Ref', 'Debit', 'Kredit', 'Saldo'];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7F0' } };
  sheet.addRow(['2026-03-01', 'Transfer dari PT ABC', 'TRF001', 0, 5000000, 15000000]);
  sheet.addRow(['2026-03-02', 'Pembayaran invoice INV-2026-00001', 'INV001', 0, 1650000, 16650000]);
  const buf = await workbook.xlsx.writeBuffer();
  const filename = `Template_Rekening_Koran_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/accounting/bank-statements/:id/reconcile/export
 * Export hasil rekonsiliasi ke Excel (Matched, Suggested, Hanya di sistem, Hanya di bank).
 */
const exportReconciliationExcel = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [
      { model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']], include: [{ model: PaymentProof, as: 'MatchedPaymentProof', required: false, include: [{ model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }] }] }
    ]
  });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });

  const periodFrom = upload.period_from || (upload.Lines && upload.Lines[0] && upload.Lines[0].transaction_date);
  const periodTo = upload.period_to || (upload.Lines && upload.Lines.length && upload.Lines[upload.Lines.length - 1].transaction_date);

  const payments = await PaymentProof.findAll({
    where: {
      verified_at: { [Op.ne]: null },
      verified_status: 'verified',
      transfer_date: periodFrom && periodTo ? { [Op.between]: [periodFrom, periodTo] } : undefined
    },
    include: [
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number'], include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }
    ],
    order: [['transfer_date', 'ASC'], ['created_at', 'ASC']]
  });

  const recorded = payments.map((p) => ({
    id: p.id,
    transfer_date: p.transfer_date,
    amount: parseFloat(p.amount),
    invoice_number: p.Invoice?.invoice_number,
    payer: p.Invoice?.User?.name || p.Invoice?.User?.company_name
  }));
  const usedPaymentIds = new Set((upload.Lines || []).map((l) => l.matched_payment_proof_id).filter(Boolean));
  const matched = (upload.Lines || []).filter((l) => l.reconciliation_status === 'matched' && l.MatchedPaymentProof).map((l) => ({
    recorded: { id: l.MatchedPaymentProof.id, transfer_date: l.MatchedPaymentProof.transfer_date, amount: parseFloat(l.MatchedPaymentProof.amount), invoice_number: l.MatchedPaymentProof.Invoice?.invoice_number, payer: l.MatchedPaymentProof.Invoice?.User?.name || l.MatchedPaymentProof.Invoice?.User?.company_name },
    bankLine: l.get ? l.get({ plain: true }) : l
  }));
  const onlyInRecorded = recorded.filter((r) => !usedPaymentIds.has(r.id));
  const onlyInBank = (upload.Lines || []).filter((l) => !l.matched_payment_proof_id || l.reconciliation_status === 'unmatched').map((l) => (l.get ? l.get({ plain: true }) : l));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BGG Rekening Koran';
  const sheet = workbook.addWorksheet('Rekonsiliasi', { views: [{ state: 'frozen', ySplit: 1 }] });

  const headerStyle = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7F0' } } };
  const fmtNum = (n) => (n != null ? Number(n).toLocaleString('id-ID') : '');

  sheet.addRow([`Rekonsiliasi: ${upload.name || 'Rekening Koran'}`, '', '', '', '']).font = { bold: true, size: 12 };
  sheet.addRow(['Periode', periodFrom || '-', 's/d', periodTo || '-']);
  sheet.addRow([]);

  sheet.addRow(['COCOK (tanggal + nominal sama)', '', '', '', '']).getRow(sheet.rowCount).font = { bold: true };
  sheet.addRow(['Tgl Transfer', 'Nominal', 'Invoice / Payer', 'Tgl Bank', 'Keterangan Bank']).getRow(sheet.rowCount).eachCell((c) => { c.fill = headerStyle.fill; c.font = headerStyle.font; });
  matched.forEach((m) => {
    sheet.addRow([
      m.recorded.transfer_date,
      m.recorded.amount,
      (m.recorded.invoice_number || m.recorded.payer || '-'),
      m.bankLine.transaction_date,
      (m.bankLine.description || '').toString().slice(0, 200)
    ]);
  });
  sheet.addRow([]);

  sheet.addRow(['HANYA DI SISTEM (belum ada di bank)', '', '', '']).getRow(sheet.rowCount).font = { bold: true };
  sheet.addRow(['Tgl Transfer', 'Nominal', 'Invoice / Payer']).getRow(sheet.rowCount).eachCell((c) => { c.fill = headerStyle.fill; c.font = headerStyle.font; });
  onlyInRecorded.forEach((r) => {
    sheet.addRow([r.transfer_date, r.amount, r.invoice_number || r.payer || '-']);
  });
  sheet.addRow([]);

  sheet.addRow(['HANYA DI BANK (belum tercatat di sistem)', '', '', '']).getRow(sheet.rowCount).font = { bold: true };
  sheet.addRow(['Tgl Bank', 'Kredit', 'Keterangan']).getRow(sheet.rowCount).eachCell((c) => { c.fill = headerStyle.fill; c.font = headerStyle.font; });
  onlyInBank.forEach((b) => {
    sheet.addRow([b.transaction_date, b.amount, (b.description || '').toString().slice(0, 200)]);
  });

  const buf = await workbook.xlsx.writeBuffer();
  const filename = `Rekonsiliasi_${(upload.name || 'RekeningKoran').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/accounting/bank-statements/:id/export-pdf
 * Export rekening koran ke PDF dengan kolom bank: Tanggal, Keterangan, No Ref, Debit, Kredit, Saldo.
 * Nama file: Acc_Statement_<id>_<period_from>_<period_to>.pdf
 */
const exportStatementPdf = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [{ model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }]
  });
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });

  const lines = (upload.Lines || []).map((l) => (l.get ? l.get({ plain: true }) : l));
  const periodFrom = upload.period_from || (lines[0] && lines[0].transaction_date) || '';
  const periodTo = upload.period_to || (lines.length && lines[lines.length - 1].transaction_date) || '';
  const shortId = String(upload.id).replace(/-/g, '').slice(0, 13) || Date.now().toString(36);
  const filename = `Acc_Statement_${shortId}_${periodFrom}_${periodTo}_${Date.now()}.pdf`;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const fmtNum = (n) => (n != null && Number(n) !== 0 ? Number(n).toLocaleString('id-ID') : '');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  const trimDesc = (s, maxLen) => (s ? String(s).trim().slice(0, maxLen) : '');

  doc.fontSize(14).font('Helvetica-Bold').text('Rekening Koran Bank', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(upload.name || 'Rekening Koran', { align: 'center' });
  doc.text(`Periode: ${periodFrom || '–'} s/d ${periodTo || '–'}`, { align: 'center' });
  doc.moveDown(0.8);

  const colWidths = { date: 58, desc: 165, ref: 52, debit: 62, credit: 62, balance: 68 };
  const tableLeft = 40;
  const rowHeight = 18;
  const headerY = doc.y;

  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Tanggal', tableLeft, headerY, { width: colWidths.date });
  doc.text('Keterangan', tableLeft + colWidths.date, headerY, { width: colWidths.desc });
  doc.text('No Ref', tableLeft + colWidths.date + colWidths.desc, headerY, { width: colWidths.ref });
  doc.text('Debit', tableLeft + colWidths.date + colWidths.desc + colWidths.ref, headerY, { width: colWidths.debit, align: 'right' });
  doc.text('Kredit', tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit, headerY, { width: colWidths.credit, align: 'right' });
  doc.text('Saldo', tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit + colWidths.credit, headerY, { width: colWidths.balance, align: 'right' });

  doc.moveTo(tableLeft, headerY + 14).lineTo(tableLeft + 467, headerY + 14).stroke();
  let y = headerY + rowHeight;
  doc.font('Helvetica').fontSize(8);

  for (const line of lines) {
    if (y > 750) {
      doc.addPage({ size: 'A4', margin: 40 });
      y = 40;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Tanggal', tableLeft, y, { width: colWidths.date });
      doc.text('Keterangan', tableLeft + colWidths.date, y, { width: colWidths.desc });
      doc.text('No Ref', tableLeft + colWidths.date + colWidths.desc, y, { width: colWidths.ref });
      doc.text('Debit', tableLeft + colWidths.date + colWidths.desc + colWidths.ref, y, { width: colWidths.debit, align: 'right' });
      doc.text('Kredit', tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit, y, { width: colWidths.credit, align: 'right' });
      doc.text('Saldo', tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit + colWidths.credit, y, { width: colWidths.balance, align: 'right' });
      doc.moveTo(tableLeft, y + 14).lineTo(tableLeft + 467, y + 14).stroke();
      y += rowHeight;
      doc.font('Helvetica').fontSize(8);
    }
    const debit = parseFloat(line.amount_debit) || 0;
    const credit = parseFloat(line.amount_credit) || 0;
    const amount = parseFloat(line.amount) || 0;
    const showDebit = debit > 0 ? debit : (amount < 0 ? Math.abs(amount) : '');
    const showCredit = credit > 0 ? credit : (amount > 0 ? amount : '');
    doc.text(fmtDate(line.transaction_date), tableLeft, y, { width: colWidths.date });
    doc.text(trimDesc(line.description, 45), tableLeft + colWidths.date, y, { width: colWidths.desc });
    doc.text(trimDesc(line.reference_number, 12), tableLeft + colWidths.date + colWidths.desc, y, { width: colWidths.ref });
    doc.text(fmtNum(showDebit), tableLeft + colWidths.date + colWidths.desc + colWidths.ref, y, { width: colWidths.debit, align: 'right' });
    doc.text(fmtNum(showCredit), tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit, y, { width: colWidths.credit, align: 'right' });
    doc.text(fmtNum(line.balance_after), tableLeft + colWidths.date + colWidths.desc + colWidths.ref + colWidths.debit + colWidths.credit, y, { width: colWidths.balance, align: 'right' });
    y += rowHeight;
  }

  doc.end();
});

/**
 * DELETE /api/v1/accounting/bank-statements/:id
 */
const deleteBankStatement = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id);
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  if (upload.original_file_path) {
    try {
      const p = path.join(uploadsConfig.UPLOAD_ROOT, upload.original_file_path);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) { /* ignore */ }
  }
  await upload.destroy();
  res.json({ success: true, message: 'Rekening koran telah dihapus' });
});

module.exports = {
  uploadBankStatement,
  listBankStatements,
  getBankStatement,
  getOriginalFile,
  getReconciliation,
  approveSuggested,
  manualMap,
  finalizeReconciliation,
  deleteBankStatement,
  downloadTemplate,
  exportReconciliationExcel,
  exportStatementPdf
};
