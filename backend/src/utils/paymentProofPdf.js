/**
 * Generate PDF bukti pembayaran (payment proof) untuk preview/display.
 * Layout modern dan rapi.
 */
const PDFDocument = require('pdfkit');

const PAYMENT_TYPE_LABELS = {
  dp: 'Down Payment (DP)',
  partial: 'Pembayaran Sebagian',
  full: 'Pelunasan'
};

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

function formatDate(d) {
  if (!d) return '-';
  const x = new Date(d);
  return x.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderPaymentProofPdf(doc, data) {
  const margin = 50;
  const pageWidth = doc.page.width - margin * 2;
  let y = margin;

  // Header
  doc.fontSize(22).fillColor('#0f766e').text('BINTANG GLOBAL GROUP', margin, y);
  y += 28;
  doc.fontSize(10).fillColor('#64748b').text('Travel & Umroh | Bukti Pembayaran', margin, y);
  y += 24;
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(margin, y).lineTo(doc.page.width - margin, y).stroke();
  y += 24;

  const typeLabel = PAYMENT_TYPE_LABELS[data.payment_type] || data.payment_type;
  doc.fontSize(12).fillColor('#334155');
  doc.text(`Invoice: ${data.invoice_number || '-'}`, margin, y);
  doc.text(`Tipe: ${typeLabel}`, margin + pageWidth * 0.4, y);
  doc.text(`Tanggal Transfer: ${formatDate(data.transfer_date)}`, margin + pageWidth * 0.7, y);
  y += 28;

  // Card info
  const cardY = y;
  doc.roundedRect(margin, cardY, pageWidth, 100, 8).fill('#f0fdfa').stroke('#99f6e4');
  y = cardY + 20;
  doc.fontSize(14).fillColor('#0f766e').text('Rincian Pembayaran', margin + 16, y);
  y += 28;
  doc.fontSize(11).fillColor('#334155');
  doc.text(`Nominal: ${formatIDR(parseFloat(data.amount))}`, margin + 16, y);
  y += 22;
  if (data.bank_name) doc.text(`Bank: ${data.bank_name}`, margin + 16, y);
  if (data.account_number) doc.text(`Rekening: ${data.account_number}`, margin + pageWidth * 0.35, y);
  y += 22;
  if (data.notes) doc.text(`Catatan: ${data.notes}`, margin + 16, y);
  y = cardY + 100 + 24;

  // Placeholder area (simulasi screenshot transfer)
  doc.fontSize(10).fillColor('#94a3b8').text('Area bukti transfer / screenshot', margin, y);
  y += 16;
  doc.roundedRect(margin, y, pageWidth, 180, 6).fill('#f8fafc').stroke('#e2e8f0');
  doc.fontSize(9).fillColor('#94a3b8').text('File bukti asli ditampilkan di aplikasi', margin + 20, y + 80, { width: pageWidth - 40, align: 'center' });
  y += 200;

  // Footer
  doc.fontSize(8).fillColor('#94a3b8');
  doc.text('Dokumen ini adalah contoh bukti pembayaran. File asli diupload oleh owner.', margin, y);
  doc.text(`Dibuat: ${formatDate(new Date())}`, margin, y + 14);
}

/**
 * Build buffer PDF dari data bukti bayar.
 * @param {Object} data - { invoice_number, payment_type, amount, bank_name, account_number, transfer_date, notes }
 * @returns {Promise<Buffer>}
 */
async function buildPaymentProofPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderPaymentProofPdf(doc, data);
    doc.end();
  });
}

module.exports = {
  renderPaymentProofPdf,
  buildPaymentProofPdfBuffer,
  PAYMENT_TYPE_LABELS
};
