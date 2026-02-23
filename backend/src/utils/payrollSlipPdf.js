/**
 * Generate PDF slip gaji - layout rapi untuk karyawan
 */
const PDFDocument = require('pdfkit');

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(n) || 0);
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/**
 * @param {PDFDocument} doc
 * @param {object} opts - { companyName, companyAddress, employeeName, periodMonth, periodYear, baseSalary, allowances[], deductions[], gross, totalDeductions, net }
 */
function renderPayrollSlipPdf(doc, opts) {
  const margin = 50;
  const pageWidth = doc.page.width - margin * 2;
  let y = margin;

  const companyName = opts.companyName || 'BINTANG GLOBAL GROUP';
  const companyAddress = opts.companyAddress || 'Travel & Umroh';
  const employeeName = opts.employeeName || '-';
  const periodMonth = opts.periodMonth != null ? opts.periodMonth : new Date().getMonth() + 1;
  const periodYear = opts.periodYear != null ? opts.periodYear : new Date().getFullYear();
  const periodLabel = `${MONTH_NAMES[periodMonth - 1]} ${periodYear}`;

  doc.fontSize(22).fillColor('#0f766e').text(companyName, margin, y);
  y += 28;
  doc.fontSize(10).fillColor('#64748b').text(companyAddress, margin, y);
  y += 20;
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(margin, y).lineTo(doc.page.width - margin, y).stroke();
  y += 24;

  doc.fontSize(12).fillColor('#0f172a').text('SLIP GAJI', margin, y);
  y += 22;
  doc.fontSize(10).fillColor('#475569');
  doc.text(`Nama Karyawan: ${employeeName}`, margin, y);
  doc.text(`Periode: ${periodLabel}`, margin + pageWidth * 0.55, y);
  y += 28;

  const tableTop = y;
  const col1 = margin + 12;
  const col2 = margin + pageWidth - 120;
  doc.rect(margin, tableTop, pageWidth, 28).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fontSize(9).fillColor('#475569');
  doc.text('Rincian', col1, tableTop + 8);
  doc.text('Jumlah (Rp)', col2, tableTop + 8);
  y = tableTop + 32;

  doc.fontSize(10).fillColor('#334155');
  doc.text('Gaji Pokok', col1, y);
  doc.text(formatIDR(opts.baseSalary || 0), col2, y, { width: 110, align: 'right' });
  y += 22;

  const allowances = opts.allowances || [];
  allowances.forEach((a) => {
    const name = typeof a === 'object' ? (a.name || a.label || 'Tunjangan') : 'Tunjangan';
    const amount = typeof a === 'object' ? (a.amount || a.value || 0) : Number(a) || 0;
    doc.text(name, col1, y);
    doc.text(formatIDR(amount), col2, y, { width: 110, align: 'right' });
    y += 20;
  });

  const gross = opts.gross != null ? opts.gross : (parseFloat(opts.baseSalary || 0) + allowances.reduce((s, a) => s + (typeof a === 'object' ? parseFloat(a.amount || a.value || 0) : parseFloat(a) || 0), 0));
  doc.fontSize(10).fillColor('#0f766e').text('Total Penghasilan (Gross)', col1, y);
  doc.text(formatIDR(gross), col2, y, { width: 110, align: 'right' });
  y += 28;

  doc.rect(margin, y, pageWidth, 24).fillAndStroke('#fef3c7', '#fcd34d');
  doc.fontSize(9).fillColor('#92400e');
  doc.text('Potongan', col1, y + 6);
  doc.text('Jumlah (Rp)', col2, y + 6);
  y += 28;

  const deductions = opts.deductions || [];
  deductions.forEach((d) => {
    const name = typeof d === 'object' ? (d.name || d.label || 'Potongan') : 'Potongan';
    const amount = typeof d === 'object' ? (d.amount || d.value || 0) : Number(d) || 0;
    doc.fontSize(10).fillColor('#334155');
    doc.text(name, col1, y);
    doc.text(formatIDR(amount), col2, y, { width: 110, align: 'right' });
    y += 20;
  });

  const totalDeductions = opts.totalDeductions != null ? opts.totalDeductions : deductions.reduce((s, d) => s + (typeof d === 'object' ? parseFloat(d.amount || d.value || 0) : parseFloat(d) || 0), 0);
  doc.fontSize(10).fillColor('#b45309').text('Total Potongan', col1, y);
  doc.text(formatIDR(totalDeductions), col2, y, { width: 110, align: 'right' });
  y += 32;

  const net = opts.net != null ? opts.net : (gross - totalDeductions);
  doc.rect(margin, y, pageWidth, 44).fillAndStroke('#d1fae5', '#10b981');
  doc.fontSize(14).fillColor('#065f46').text('TAKE HOME PAY (Net)', col1, y + 12);
  doc.text(formatIDR(net), col2, y + 10, { width: 110, align: 'right' });
  y += 56;

  doc.fontSize(8).fillColor('#94a3b8');
  doc.text(`Dibuat otomatis oleh sistem pada ${new Date().toLocaleString('id-ID')}`, margin, y);
  doc.text(`Slip ini sah dan dapat digunakan sebagai bukti pembayaran gaji.`, margin, y + 14);
}

/**
 * Generate PDF buffer untuk satu slip gaji
 */
function buildPayrollSlipPdfBuffer(opts) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderPayrollSlipPdf(doc, opts);
    doc.end();
  });
}

module.exports = { renderPayrollSlipPdf, buildPayrollSlipPdfBuffer, formatIDR, MONTH_NAMES };
