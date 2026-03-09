/**
 * Generate PDF slip informasi visa (untuk order item visa).
 * Digabungkan ke arsip ZIP invoice.
 */
const PDFDocument = require('pdfkit');

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '–');
const formatDateTime = (d) => (d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
const visaStatusLabel = (s) => ({
  document_received: 'Dokumen diterima',
  submitted: 'Diajukan',
  in_process: 'Dalam proses',
  approved: 'Disetujui',
  issued: 'Terbit'
}[String(s).toLowerCase()] || s || '–');

/**
 * @param {object} item - OrderItem dengan Order, Product, VisaProgress
 * @returns {Promise<Buffer>}
 */
async function buildVisaSlipPdfBuffer(item) {
  const Order = item.Order || {};
  const Product = item.Product || {};
  const prog = item.VisaProgress || {};
  const orderNumber = Order.order_number || '–';
  const productName = Product.name || Product.code || 'Visa';
  const quantity = item.quantity != null ? Number(item.quantity) : 1;
  const status = visaStatusLabel(prog.status);
  const issuedAt = prog.issued_at ? formatDateTime(prog.issued_at) : '–';
  const notes = (prog.notes || '').trim() || '–';
  const ownerName = Order.User ? (Order.User.name || Order.User.company_name) : '–';
  const hasDoc = !!(prog.visa_file_url && prog.visa_file_url.trim() && prog.visa_file_url !== 'issued-saudi');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 48;
    const pageWidth = doc.page.width - margin * 2;
    let y = margin;

    doc.fontSize(18).fillColor('#0f172a');
    doc.text('Slip Informasi Visa', margin, y);
    y += 28;

    doc.fontSize(10).fillColor('#475569');
    doc.text(`Order: ${orderNumber}  |  Produk: ${productName}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, margin, y, { width: pageWidth });
    y += 24;

    doc.fontSize(11).fillColor('#0f172a');
    const rows = [
      ['No. Order', orderNumber],
      ['Produk / Paket Visa', productName],
      ['Pemesan (Owner)', ownerName],
      ['Jumlah', String(quantity)],
      ['Status Progress', status],
      ['Tanggal Terbit', issuedAt],
      ['Dokumen Terbit', hasDoc ? 'Ada (lihat file 05_Visa_*)' : '–'],
      ['Catatan', notes]
    ];

    const labelW = 140;
    const valueX = margin + labelW + 12;
    doc.fontSize(10);
    for (const [label, value] of rows) {
      doc.fillColor('#64748b').text(label + ':', margin, y, { width: labelW });
      doc.fillColor('#0f172a').text(String(value), valueX, y, { width: pageWidth - labelW - 12 });
      y += 22;
    }

    y += 16;
    doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke('#e2e8f0');
    y += 20;
    doc.fontSize(9).fillColor('#94a3b8');
    doc.text('Slip ini digenerate otomatis oleh sistem. Digabungkan ke arsip invoice.', margin, y, { width: pageWidth });
    y += 16;
    doc.text('Bintang Global Group - Travel & Umroh', margin, y, { width: pageWidth });

    doc.end();
  });
}

module.exports = { buildVisaSlipPdfBuffer };
