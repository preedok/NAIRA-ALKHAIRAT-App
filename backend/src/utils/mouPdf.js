/**
 * Generate MOU (Memorandum of Understanding) PDF untuk travel yang diaktivasi.
 * Berisi data legal, data travel, dan password baru yang digenerate sistem.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const uploadConfig = require('../config/uploads');
const { drawCorporateLetterhead, COMPANY_NAME } = require('./pdfLetterhead');

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
}

/**
 * Generate MOU PDF ke file; return path relatif untuk disimpan di travel_profiles.mou_generated_url
 * @param {object} opts - { user, travelProfile (or ownerProfile), newPassword, assignedBranchName }
 * @returns {Promise<string>} - URL path e.g. /uploads/mou/MOU_Generated_Travel_xxx.pdf
 */
async function generateMouPdf(opts) {
  const { user, newPassword, assignedBranchName } = opts;
  const profile = opts.travelProfile || opts.ownerProfile || {};
  const margin = 50;
  const doc = new PDFDocument({ size: 'A4', margin });
  const dir = uploadConfig.getDir(uploadConfig.SUBDIRS.MOU);
  const { date, time } = uploadConfig.dateTimeForFilename();
  const userId6 = (user.id || '').toString().slice(-6);
  const filename = `MOU_Generated_Travel_${userId6}_${date}_${time}.pdf`;
  const filepath = path.join(dir, filename);
  const out = fs.createWriteStream(filepath);
  doc.pipe(out);

  let y = drawCorporateLetterhead(doc, { margin });
  const pageWidth = doc.page.width - margin * 2;

  doc.fontSize(18).fillColor('#0f172a').text('MEMORANDUM OF UNDERSTANDING (MoU)', margin, y, { align: 'center' });
  y += 28;
  doc.fontSize(11).fillColor('#475569').text('Kerjasama Partner Travel dengan Bintang Global Group', margin, y, { align: 'center' });
  y += 36;

  doc.fontSize(10).fillColor('#334155');
  doc.text(`Tanggal: ${formatDate(new Date())}`, margin, y);
  y += 24;

  const paragraphs = [
    'Dengan ini kedua belah pihak menyatakan sepakat untuk menjalin kerjasama dalam rangka penjualan paket umroh dan travel yang dikelola oleh Bintang Global Group.',
    `Pihak Pertama (Partner Travel): ${user.name || '-'}${user.company_name ? `, ${user.company_name}` : ''}.`,
    `Alamat: ${profile.address || '-'}. Kontak: ${profile.whatsapp || user.phone || user.email || '-'}.`,
    `Pihak Kedua: Bintang Global Group. Cabang terdaftar: ${assignedBranchName || '-'}.`,
    'Seluruh transaksi, pembayaran, dan ketentuan mengikuti kebijakan Bintang Global Group. Partner wajib mematuhi prosedur dan tata kelola yang berlaku.',
    'Dokumen ini digenerate secara otomatis oleh sistem dan berlaku sebagai surat perjanjian kerjasama setelah akun partner diaktivasi oleh Admin Pusat.'
  ];
  paragraphs.forEach(p => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = margin;
    }
    doc.fontSize(10).fillColor('#334155').text(p, margin, y, { width: pageWidth, lineGap: 4 });
    y += doc.heightOfString(p, { width: pageWidth }) + 12;
  });

  y += 20;
  if (y > doc.page.height - 140) {
    doc.addPage();
    y = margin;
  }
  doc.fontSize(11).fillColor('#0f172a').text('Data Akses Login (Rahasia)', margin, y);
  y += 22;
  doc.rect(margin, y, pageWidth, 72).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fontSize(10).fillColor('#475569');
  doc.text(`Email: ${user.email || '-'}`, margin + 12, y + 12);
  doc.text(`Password baru (gunakan untuk login; simpan dengan aman): ${newPassword}`, margin + 12, y + 32);
  doc.text('Password yang Anda buat saat pendaftaran tidak lagi berlaku. Gunakan password di atas.', margin + 12, y + 52);
  y += 90;

  doc.fontSize(9).fillColor('#64748b').text(`Dokumen ini sah dan digenerate otomatis oleh sistem ${COMPANY_NAME}.`, margin, y);
  y += 14;
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, margin, y);

  doc.end();
  await new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });

  return uploadConfig.toUrlPath(uploadConfig.SUBDIRS.MOU, filename);
}

module.exports = { generateMouPdf };
