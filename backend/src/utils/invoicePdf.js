/**
 * Invoice PDF generator - layout modern dan rapi
 * Mendukung semua status invoice
 */
const PDFDocument = require('pdfkit');

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const paymentTypeLabel = (t) => (t === 'dp' ? 'DP' : t === 'partial' ? 'Cicilan' : t === 'full' ? 'Lunas' : t || '-');
const verifiedStatusLabel = (s) => (s === 'verified' ? 'Diverifikasi' : s === 'rejected' ? 'Ditolak' : 'Menunggu');

const STATUS_LABELS = {
  draft: 'Draft',
  tentative: 'Tagihan DP',
  partial_paid: 'Pembayaran DP',
  paid: 'Lunas',
  processing: 'Processing',
  completed: 'Completed',
  overdue: 'Overdue',
  canceled: 'Dibatalkan',
  refunded: 'Refund Dana',
  order_updated: 'Order Diupdate',
  overpaid: 'Kelebihan Bayar',
  overpaid_transferred: 'Pindahan (Sumber)',
  overpaid_received: 'Pindahan (Penerima)',
  refund_canceled: 'Refund Dibatalkan',
  overpaid_refund_pending: 'Sisa Pengembalian'
};

/**
 * @param {PDFDocument} doc
 * @param {object} data - invoice data (dari DB atau contoh)
 */
function renderInvoicePdf(doc, data) {
  const margin = 50;
  const pageWidth = doc.page.width - margin * 2;
  let y = margin;

  // Header - Logo area & Company
  doc.fontSize(24).fillColor('#0f766e').text('BINTANG GLOBAL GROUP', margin, y);
  y += 32;
  doc.fontSize(10).fillColor('#64748b').text('Travel & Umroh | Invoice Resmi', margin, y);
  y += 24;

  // Garis pemisah
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(margin, y).lineTo(doc.page.width - margin, y).stroke();
  y += 20;

  // Baris 1: Invoice # | Status | Tanggal
  const statusLabel = STATUS_LABELS[data.status] || data.status;
  doc.fontSize(11).fillColor('#334155');
  doc.text(`Invoice: ${data.invoice_number || 'INV-2025-00001'}`, margin, y);
  doc.text(`Status: ${statusLabel}`, margin + pageWidth * 0.5, y);
  doc.text(`Tanggal: ${formatDate(data.issued_at || data.created_at)}`, margin + pageWidth * 0.75, y);
  y += 22;

  // Info Owner & Cabang (nomor/status dari invoice saja)
  doc.fontSize(10).fillColor('#64748b');
  doc.text(`Owner: ${data.User?.name || data.User?.company_name || '-'}`, margin, y);
  doc.text(`Cabang: ${data.Branch?.name || data.Branch?.code || '-'}`, margin + pageWidth * 0.5, y);
  y += 28;

  // Tabel item (ringkas)
  doc.fontSize(10).fillColor('#0f172a');
  doc.text('Rincian', margin, y);
  y += 18;

  const tableTop = y;
  doc.rect(margin, tableTop, pageWidth, 24).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fontSize(9).fillColor('#475569');
  doc.text('Deskripsi', margin + 12, tableTop + 8);
  doc.text('Jumlah', margin + pageWidth - 100, tableTop + 8);
  y = tableTop + 28;

  const items = data.Order?.OrderItems || [];
  const totalAmount = parseFloat(data.total_amount || 0);
  if (items.length > 0) {
    items.forEach((item, i) => {
      const desc = item.Product?.name || item.product_name || `Item ${i + 1}`;
      const amt = parseFloat(item.subtotal || item.unit_price || 0);
      doc.fontSize(9).fillColor('#334155');
      doc.text(String(desc).slice(0, 50), margin + 12, y);
      doc.text(formatIDR(amt), margin + pageWidth - 100, y);
      y += 20;
    });
  } else {
    doc.fontSize(9).fillColor('#64748b').text('Paket Umroh / Layanan', margin + 12, y);
    doc.text(formatIDR(totalAmount), margin + pageWidth - 100, y);
    y += 20;
  }

  y += 12;

  // Summary box
  const boxTop = y;
  doc.rect(margin, boxTop, pageWidth * 0.4, 100).fillAndStroke('#f0fdfa', '#99f6e4');
  y = boxTop + 14;
  doc.fontSize(9).fillColor('#0f766e');
  doc.text('Total Tagihan', margin + 14, y);
  doc.text(formatIDR(totalAmount), margin + pageWidth * 0.4 - 110, y, { width: 90, align: 'right' });
  y += 18;
  doc.text('DP (30%)', margin + 14, y);
  doc.text(formatIDR(data.dp_amount || totalAmount * 0.3), margin + pageWidth * 0.4 - 110, y, { width: 90, align: 'right' });
  y += 18;
  doc.text('Dibayar', margin + 14, y);
  doc.text(formatIDR(data.paid_amount || 0), margin + pageWidth * 0.4 - 110, y, { width: 90, align: 'right' });
  y += 18;
  doc.text('Sisa', margin + 14, y);
  doc.text(formatIDR(data.remaining_amount || totalAmount), margin + pageWidth * 0.4 - 110, y, { width: 90, align: 'right' });

  if (parseFloat(data.overpaid_amount || 0) > 0) {
    y += 18;
    doc.fillColor('#b45309').text('Kelebihan Bayar', margin + 14, y);
    doc.text(formatIDR(data.overpaid_amount), margin + pageWidth * 0.4 - 110, y, { width: 90, align: 'right' });
  }

  y = boxTop + 110;

  // Riwayat Pembayaran & Bukti Bayar
  const proofs = (data.PaymentProofs || []).slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  if (proofs.length > 0) {
    if (y > doc.page.height - 180) { doc.addPage(); y = margin; }
    doc.fontSize(10).fillColor('#0f172a').text('Riwayat Pembayaran & Bukti Bayar', margin, y);
    y += 16;

    const payTableTop = y;
    const cw = [0.035, 0.12, 0.12, 0.07, 0.13, 0.15, 0.10, 0.13, 0.145]; // No, TglTransfer, TglUpload, Tipe, Jumlah, Bank, Status, TglVerif, File
    const x0 = margin + 6;
    const x = (i) => margin + pageWidth * cw.slice(0, i).reduce((s, w) => s + w, 0) + 4;
    const w = (i) => pageWidth * cw[i] - 8;
    doc.rect(margin, payTableTop, pageWidth, 20).fillAndStroke('#f1f5f9', '#e2e8f0');
    doc.fontSize(8).fillColor('#475569');
    doc.text('No', x0, payTableTop + 6, { width: w(0) });
    doc.text('Tgl Transfer', x(1), payTableTop + 6, { width: w(1) });
    doc.text('Tgl Upload', x(2), payTableTop + 6, { width: w(2) });
    doc.text('Tipe', x(3), payTableTop + 6, { width: w(3) });
    doc.text('Jumlah', x(4), payTableTop + 6, { width: w(4) });
    doc.text('Bank / Rekening', x(5), payTableTop + 6, { width: w(5) });
    doc.text('Status', x(6), payTableTop + 6, { width: w(6) });
    doc.text('Tgl Verifikasi', x(7), payTableTop + 6, { width: w(7) });
    doc.text('File Bukti', x(8), payTableTop + 6, { width: w(8) });
    y = payTableTop + 22;

    proofs.forEach((p, idx) => {
      if (y > doc.page.height - 50) { doc.addPage(); y = margin; }
      const tglTransfer = formatDate(p.transfer_date);
      const tglUpload = p.created_at ? formatDateTime(p.created_at) : '-';
      const tipe = paymentTypeLabel(p.payment_type);
      const jumlah = formatIDR(parseFloat(p.amount || 0));
      const bank = [p.bank_name, p.account_number].filter(Boolean).join(' ') || '-';
      const status = verifiedStatusLabel(p.verified_status);
      const tglVerif = p.verified_at ? formatDateTime(p.verified_at) : '-';
      let fileInfo = '-';
      if (p.proof_file_url && p.proof_file_url !== 'issued-saudi') {
        const match = p.proof_file_url.match(/\/([^/]+)$/);
        fileInfo = match ? match[1] : 'Lampiran';
      } else if (p.proof_file_url === 'issued-saudi') fileInfo = 'Pembayaran Saudi';
      doc.fontSize(8).fillColor('#334155');
      doc.text(String(idx + 1), x0, y, { width: w(0) });
      doc.text(tglTransfer, x(1), y, { width: w(1) });
      doc.text(tglUpload, x(2), y, { width: w(2) });
      doc.text(tipe, x(3), y, { width: w(3) });
      doc.text(jumlah, x(4), y, { width: w(4) });
      doc.text(String(bank).slice(0, 22), x(5), y, { width: w(5) });
      doc.text(status, x(6), y, { width: w(6) });
      doc.text(tglVerif, x(7), y, { width: w(7) });
      doc.text(String(fileInfo).slice(0, 26), x(8), y, { width: w(8) });
      y += 18;
    });
    y += 14;
  }

  // Terms
  const terms = data.terms || [];
  if (terms.length > 0) {
    if (y > doc.page.height - 120) { doc.addPage(); y = margin; }
    doc.fontSize(9).fillColor('#64748b').text('Ketentuan:', margin, y);
    y += 14;
    terms.forEach((t) => {
      doc.text(`• ${t}`, margin + 8, y);
      y += 14;
    });
    y += 8;
  }

  // Footer
  doc.fontSize(8).fillColor('#94a3b8');
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')} | Bintang Global Group`, margin, doc.page.height - 40, { align: 'center', width: pageWidth });
}

/**
 * Generate PDF buffer dari data invoice
 */
function buildInvoicePdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoicePdf(doc, data);
    doc.end();
  });
}

module.exports = { renderInvoicePdf, buildInvoicePdfBuffer, formatIDR, formatDate, STATUS_LABELS };
