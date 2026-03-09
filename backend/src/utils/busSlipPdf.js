/**
 * Generate PDF slip informasi bus (untuk order item bus).
 * Digabungkan ke arsip ZIP invoice.
 */
const PDFDocument = require('pdfkit');

const busTicketStatusLabel = (s) => ({ pending: 'Menunggu', issued: 'Terbit' }[String(s).toLowerCase()] || s || '–');
const busTripStatusLabel = (s) => ({ pending: 'Menunggu', scheduled: 'Terjadwal', completed: 'Selesai' }[String(s).toLowerCase()] || s || '–');
const busRouteLabel = (r) => ({
  full_route: 'Full rute (Mekkah–Madinah)',
  bandara_makkah: 'Bandara–Mekkah',
  bandara_madinah: 'Bandara–Madinah',
  bandara_madinah_only: 'Bandara–Madinah saja',
  hotel_makkah_madinah: 'Hotel Mekkah–Madinah',
  hotel_madinah_makkah: 'Hotel Madinah–Mekkah'
}[String(r).toLowerCase()] || r || '–');

/**
 * @param {object} item - OrderItem dengan Order, Product, BusProgress
 * @returns {Promise<Buffer>}
 */
async function buildBusSlipPdfBuffer(item) {
  const Order = item.Order || {};
  const Product = item.Product || {};
  const prog = item.BusProgress || {};
  const meta = (item.meta && typeof item.meta === 'object') ? item.meta : {};
  const orderNumber = Order.order_number || '–';
  const productName = Product.name || Product.code || 'Bus';
  const quantity = item.quantity != null ? Number(item.quantity) : 1;
  const ownerName = Order.User ? (Order.User.name || Order.User.company_name) : '–';
  const ticketStatus = busTicketStatusLabel(prog.bus_ticket_status);
  const ticketInfo = (prog.bus_ticket_info || '').trim() || '–';
  const arrival = busTripStatusLabel(prog.arrival_status);
  const departure = busTripStatusLabel(prog.departure_status);
  const returnStatus = busTripStatusLabel(prog.return_status);
  const route = busRouteLabel(meta.bus_route || meta.route);
  const notes = (prog.notes || '').trim() || '–';

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
    doc.text('Slip Informasi Bus', margin, y);
    y += 28;

    doc.fontSize(10).fillColor('#475569');
    doc.text(`Order: ${orderNumber}  |  Produk: ${productName}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, margin, y, { width: pageWidth });
    y += 24;

    doc.fontSize(11).fillColor('#0f172a');
    const rows = [
      ['No. Order', orderNumber],
      ['Produk / Paket Bus', productName],
      ['Pemesan (Owner)', ownerName],
      ['Jumlah', String(quantity)],
      ['Rute', route],
      ['Status Tiket Bus', ticketStatus],
      ['Info Tiket Bus', ticketInfo],
      ['Status Kedatangan', arrival],
      ['Status Keberangkatan', departure],
      ['Status Kepulangan', returnStatus],
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

module.exports = { buildBusSlipPdfBuffer };
