/**
 * Generate PDF dokumen informasi hotel (untuk order item hotel).
 * Digenerate otomatis setelah penetapan room + selesai makan, lalu digabung ke arsip ZIP invoice.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const { drawCorporateLetterhead, COMPANY_NAME } = require('./pdfLetterhead');

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '–');
const formatDateShort = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–');
const mealStatusLabel = (s) => ({ pending: 'Menunggu', confirmed: 'Dikonfirmasi', completed: 'Selesai' }[String(s).toLowerCase()] || s || '–');
const hotelProgressStatusLabel = (s) => ({
  waiting_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Penetapan room',
  room_assigned: 'Pemberian nomor room',
  completed: 'Selesai'
}[String(s).toLowerCase()] || s || '–');
const roomTypeLabel = (r) => ({ double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint', single: 'Double' }[String(r).toLowerCase()] || r || '–');

/**
 * @param {object} item - OrderItem dengan Order, Product, HotelProgress
 * @param {object} [opts] - { invoice } agar No. Invoice terisi
 * @returns {Promise<Buffer>}
 */
async function buildHotelInfoPdfBuffer(item, opts = {}) {
  const Order = item.Order || {};
  const Product = item.Product || {};
  const prog = item.HotelProgress || {};
  const meta = (item.meta && typeof item.meta === 'object') ? item.meta : {};
  const inv = opts.invoice || {};

  const invoiceNumber = (inv.invoice_number || '').trim() || '–';
  const productName = Product.name || Product.code || 'Hotel';
  const roomType = roomTypeLabel(meta.room_type || meta.roomType);
  const quantity = item.quantity != null ? Number(item.quantity) : 1;
  const nights = meta.nights != null ? Number(meta.nights) : 0;
  const roomNumber = (prog.room_number || '').trim() || '–';
  const mealStatus = mealStatusLabel(prog.meal_status);
  const progressStatus = hotelProgressStatusLabel(prog.status);
  const checkInDate = prog.check_in_date || meta.check_in;
  const checkOutDate = prog.check_out_date || meta.check_out;
  const checkInTime = (prog.check_in_time || '16:00').toString().trim();
  const checkOutTime = (prog.check_out_time || '12:00').toString().trim();
  const notes = (prog.notes || '').trim() || '–';
  const ownerName = Order.User ? (Order.User.name || Order.User.company_name) : '–';
  const picName =
    (inv.pic_name != null && String(inv.pic_name).trim()) ||
    (Order.pic_name != null && String(Order.pic_name).trim()) ||
    '';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 48;
    const pageWidth = doc.page.width - margin * 2;
    let y = drawCorporateLetterhead(doc, { margin });

    doc.fontSize(18).fillColor('#0f172a');
    doc.text('Informasi Hotel', margin, y);
    y += 28;

    doc.fontSize(10).fillColor('#475569');
    doc.text(`Invoice: ${invoiceNumber}  |  Produk: ${productName}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, margin, y, { width: pageWidth });
    y += 24;

    doc.fontSize(11).fillColor('#0f172a');
    const rows = [
      ['No. Invoice', invoiceNumber],
      ['Produk / Paket Hotel', productName],
      ['Pemesan (Owner)', ownerName],
      ['Nama PIC', picName || '–'],
      ['Tipe Kamar', roomType],
      ['Jumlah Kamar', String(quantity)],
      ['Malam', nights ? `${nights} malam` : '–'],
      ['Nomor Kamar', roomNumber],
      ['Status Progress', progressStatus],
      ['Status Makan', mealStatus],
      ['Check-in', checkInDate ? `${formatDateShort(checkInDate)} ${checkInTime}` : '–'],
      ['Check-out', checkOutDate ? `${formatDateShort(checkOutDate)} ${checkOutTime}` : '–'],
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
    doc.text('Dokumen ini digenerate otomatis oleh sistem setelah penetapan room dan selesai makan. Digabungkan ke arsip invoice.', margin, y, { width: pageWidth });
    y += 16;
    doc.text(COMPANY_NAME, margin, y, { width: pageWidth });

    doc.end();
  });
}

module.exports = { buildHotelInfoPdfBuffer };
