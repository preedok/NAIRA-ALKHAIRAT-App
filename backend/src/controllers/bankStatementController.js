const asyncHandler = require('express-async-handler');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { BankStatementUpload, BankStatementLine, PaymentProof, Invoice, User } = require('../models');

const memoryStorage = multer.memoryStorage();
const uploadExcel = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname) || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel';
    if (ok) cb(null, true);
    else cb(new Error('Hanya file Excel (.xlsx, .xls) yang diperbolehkan'));
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
 * Parse nilai angka dari cell (string atau number).
 */
function parseAmount(val) {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.abs(val);
  const s = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Parse tanggal dari cell (Excel serial number atau string).
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const d = ExcelJS.valueToDate(val);
    return d ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) {
    if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

/**
 * POST /api/v1/accounting/bank-statements/upload
 * Upload file Excel rekening koran; parse dan simpan ke bank_statement_uploads + bank_statement_lines.
 * Body (form): file (required), name (optional), period_from, period_to (optional).
 */
const uploadBankStatement = [
  uploadExcel.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File Excel wajib diunggah' });
    }
    const name = (req.body.name && String(req.body.name).trim()) || `Rekening Koran ${new Date().toLocaleDateString('id-ID')}`;
    const periodFrom = req.body.period_from && String(req.body.period_from).trim() ? String(req.body.period_from).trim() : null;
    const periodTo = req.body.period_to && String(req.body.period_to).trim() ? String(req.body.period_to).trim() : null;

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

    const upload = await BankStatementUpload.create({
      name,
      period_from: periodFrom,
      period_to: periodTo,
      file_name: req.file.originalname,
      uploaded_by: req.user.id
    });

    let periodMin = periodFrom;
    let periodMax = periodTo;
    const lines = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i].cells || [];
      const rawDate = r[dateCol];
      const transactionDate = parseDate(rawDate);
      if (!transactionDate) continue;

      const debitVal = parseAmount(r[debitCol]);
      const creditVal = parseAmount(r[creditCol]);
      const amount = creditVal > 0 ? creditVal : -debitVal;
      const balanceAfter = balanceCol != null && r[balanceCol] != null ? parseAmount(r[balanceCol]) : null;

      lines.push({
        upload_id: upload.id,
        transaction_date: transactionDate,
        description: r[descCol] != null ? String(r[descCol]).trim().slice(0, 2000) : null,
        reference_number: r[refCol] != null ? String(r[refCol]).trim().slice(0, 100) : null,
        amount_debit: debitVal,
        amount_credit: creditVal,
        amount: amount,
        balance_after: balanceAfter,
        row_index: i + 1
      });

      if (!periodMin || transactionDate < periodMin) periodMin = transactionDate;
      if (!periodMax || transactionDate > periodMax) periodMax = transactionDate;
    }

    if (lines.length === 0) {
      await upload.destroy();
      return res.status(400).json({ success: false, message: 'Tidak ada baris transaksi valid (tanggal + debit/kredit) ditemukan di file' });
    }

    await BankStatementLine.bulkCreate(lines);
    if (!upload.period_from && periodMin) await upload.update({ period_from: periodMin });
    if (!upload.period_to && periodMax) await upload.update({ period_to: periodMax });

    const withLines = await BankStatementUpload.findByPk(upload.id, {
      include: [{ model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }]
    });
    res.status(201).json({
      success: true,
      data: withLines,
      message: `${lines.length} baris rekening koran berhasil diimpor.`
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
 * GET /api/v1/accounting/bank-statements/:id/reconcile
 * Rekonsiliasi: bandingkan penerimaan yang dicatat (payment proofs) dengan data bank (lines).
 * Return: recorded (payment proofs dalam periode upload), bankLines, matched pairs, onlyInRecorded, onlyInBank.
 */
const getReconciliation = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [{ model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }]
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

  const bankLines = (upload.Lines || []).filter((l) => Number(l.amount) > 0);
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

  const matched = [];
  const usedBank = new Set();
  const usedRecorded = new Set();

  for (const rec of recorded) {
    const amt = Math.round(rec.amount * 100) / 100;
    const date = rec.transfer_date;
    const bankLine = bankLines.find((b) => {
      if (usedBank.has(b.id)) return false;
      const bAmt = Math.round(parseFloat(b.amount) * 100) / 100;
      return bAmt === amt && b.transaction_date === date;
    });
    if (bankLine) {
      usedBank.add(bankLine.id);
      usedRecorded.add(rec.id);
      matched.push({ recorded: rec, bankLine: bankLine.get ? bankLine.get({ plain: true }) : bankLine });
    }
  }

  const onlyInRecorded = recorded.filter((r) => !usedRecorded.has(r.id));
  const onlyInBank = bankLines.filter((b) => !usedBank.has(b.id));

  res.json({
    success: true,
    data: {
      upload: upload.get ? upload.get({ plain: true }) : upload,
      recorded,
      bankLines: bankLines.map((l) => (l.get ? l.get({ plain: true }) : l)),
      matched,
      onlyInRecorded,
      onlyInBank
    }
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
 * Export hasil rekonsiliasi ke Excel (Cocok, Hanya di sistem, Hanya di bank).
 */
const exportReconciliationExcel = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id, {
    include: [{ model: BankStatementLine, as: 'Lines', order: [['transaction_date', 'ASC'], ['row_index', 'ASC']] }]
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

  const bankLines = (upload.Lines || []).filter((l) => Number(l.amount) > 0);
  const recorded = payments.map((p) => ({
    id: p.id,
    transfer_date: p.transfer_date,
    amount: parseFloat(p.amount),
    invoice_number: p.Invoice?.invoice_number,
    payer: p.Invoice?.User?.name || p.Invoice?.User?.company_name
  }));

  const matched = [];
  const usedBank = new Set();
  const usedRecorded = new Set();
  for (const rec of recorded) {
    const amt = Math.round(rec.amount * 100) / 100;
    const date = rec.transfer_date;
    const bankLine = bankLines.find((b) => {
      if (usedBank.has(b.id)) return false;
      const bAmt = Math.round(parseFloat(b.amount) * 100) / 100;
      return bAmt === amt && b.transaction_date === date;
    });
    if (bankLine) {
      usedBank.add(bankLine.id);
      usedRecorded.add(rec.id);
      matched.push({ recorded: rec, bankLine: bankLine.get ? bankLine.get({ plain: true }) : bankLine });
    }
  }
  const onlyInRecorded = recorded.filter((r) => !usedRecorded.has(r.id));
  const onlyInBank = bankLines.filter((b) => !usedBank.has(b.id)).map((l) => (l.get ? l.get({ plain: true }) : l));

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
 * DELETE /api/v1/accounting/bank-statements/:id
 */
const deleteBankStatement = asyncHandler(async (req, res) => {
  const upload = await BankStatementUpload.findByPk(req.params.id);
  if (!upload) return res.status(404).json({ success: false, message: 'Data rekening koran tidak ditemukan' });
  await upload.destroy();
  res.json({ success: true, message: 'Rekening koran telah dihapus' });
});

module.exports = {
  uploadBankStatement,
  listBankStatements,
  getBankStatement,
  getReconciliation,
  deleteBankStatement,
  downloadTemplate,
  exportReconciliationExcel
};
