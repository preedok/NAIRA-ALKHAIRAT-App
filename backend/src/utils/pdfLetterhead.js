const fs = require('fs');
const path = require('path');

const COMPANY_NAME = 'PT. BINTANG GLOBAL GRUP';
const COMPANY_ADDRESS = 'Jl. Raya Condet No.8, RT.5/RW.3, Cililitan, Kec. Kramat jati, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13530.';
const COMPANY_CONTACT = 'Hotline: 0858 5058 1030   www.bintangglobalgrup.com   bintangglobalgrup@gmail.com';

function getLetterheadLogoPath() {
  const p = path.join(__dirname, '..', 'assets', 'logo-bg-hotel.png');
  return fs.existsSync(p) ? p : null;
}

/**
 * Draw standardized corporate letterhead and return next Y position.
 * Keeps all non-invoice PDFs visually consistent and formal.
 */
function drawCorporateLetterhead(doc, { margin = 48 } = {}) {
  const pageWidth = doc.page.width - margin * 2;
  const x = margin;
  let y = margin;
  const logoBoxW = 86;
  const logoBoxH = 64;
  const logoPath = getLetterheadLogoPath();
  if (logoPath) {
    doc.image(logoPath, x, y, { fit: [logoBoxW, logoBoxH], align: 'left', valign: 'top' });
  } else {
    doc.roundedRect(x, y + 2, logoBoxW, logoBoxH, 6).lineWidth(1).strokeColor('#0b4f82').stroke();
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0b4f82').text('BG', x + 21, y + 18, { width: 44, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('PT. BINTANG GLOBAL GRUP', x + 3, y + 50, { width: logoBoxW - 6, align: 'center' });
  }

  const headerX = x + logoBoxW + 12;
  const headerW = pageWidth - logoBoxW - 12;
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#0b4f82').text(COMPANY_NAME, headerX, y, { width: headerW, align: 'center' });
  y += 34;
  doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(COMPANY_ADDRESS, headerX, y, { width: headerW, align: 'center' });
  y += 28;
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(COMPANY_CONTACT, headerX, y, { width: headerW, align: 'center' });
  y += 18;

  const lineY = Math.max(y, margin + logoBoxH + 8);
  doc.moveTo(x, lineY).lineTo(x + pageWidth, lineY).lineWidth(2).strokeColor('#2f89c8').stroke();
  return lineY + 18;
}

module.exports = {
  drawCorporateLetterhead,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  COMPANY_CONTACT
};
