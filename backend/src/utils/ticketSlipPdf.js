/**
 * Generate PDF slip informasi tiket (untuk order item tiket).
 * Digabungkan ke arsip ZIP invoice.
 */
const PDFDocument = require('pdfkit');

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '–');
const formatDateTime = (d) => (d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
const ticketStatusLabel = (s) => ({
  pending: 'Menunggu',
  data_received: 'Data diterima',
  seat_reserved: 'Kursi dipesan',
  booking: 'Booking',
  payment_airline: 'Pembayaran maskapai',
  ticket_issued: 'Tiket terbit'
}[String(s).toLowerCase()] || s || '–');

/**
 * @param {object} item - OrderItem dengan Product, TicketProgress (Order bisa dari opts)
 * @param {object} [opts] - { order, invoice } agar No. Invoice & Pemesan selalu terisi
 * @returns {Promise<Buffer>}
 */
async function buildTicketSlipPdfBuffer(item, opts = {}) {
  const Order = opts.order || item.Order || {};
  const Product = item.Product || {};
  const prog = item.TicketProgress || {};
  const meta = (item.meta && typeof item.meta === 'object') ? item.meta : {};
  const inv = opts.invoice || {};
  const invoiceNumber = (inv.invoice_number || '').trim() || '–';
  const productName = (Product.name || Product.code || 'Tiket').trim() || 'Tiket';
  const quantity = item.quantity != null ? Number(item.quantity) : 1;
  const status = ticketStatusLabel(prog.status);
  const issuedAt = prog.issued_at ? formatDateTime(prog.issued_at) : '–';
  const notes = (prog.notes || '').trim() || '–';
  const ownerName = (Order.User && (Order.User.name || Order.User.company_name)) || (inv.User && (inv.User.name || inv.User.company_name)) || '–';
  const hasDoc = !!(prog.ticket_file_url && prog.ticket_file_url.trim());
  const tripType = meta.trip_type || meta.tripType || '–';

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
    doc.text('Slip Informasi Tiket', margin, y);
    y += 28;

    doc.fontSize(10).fillColor('#475569');
    doc.text(`Invoice: ${invoiceNumber}  |  Produk: ${productName}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, margin, y, { width: pageWidth });
    y += 24;

    doc.fontSize(11).fillColor('#0f172a');
    const rows = [
      ['No. Invoice', invoiceNumber],
      ['Produk / Paket Tiket', productName],
      ['Pemesan (Owner)', ownerName],
      ['Jumlah', String(quantity)],
      ['Tipe Perjalanan', String(tripType)],
      ['Status Progress', status],
      ['Tanggal Terbit', issuedAt],
      ['Dokumen Terbit', hasDoc ? 'Ada (lihat file 06_Tiket_*)' : '–'],
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

module.exports = { buildTicketSlipPdfBuffer };
