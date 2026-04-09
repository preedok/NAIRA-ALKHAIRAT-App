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
  const y = margin;
  const logoBoxW = 86;
  const logoBoxH = 64;
  const logoTextGap = 8;
  const textBlockW = Math.min(430, Math.max(220, pageWidth - logoBoxW - logoTextGap));
  const groupW = logoBoxW + logoTextGap + textBlockW;
  const groupX = x + Math.max(0, (pageWidth - groupW) / 2);
  const logoX = groupX;
  const headerX = logoX + logoBoxW + logoTextGap;
  const headerW = textBlockW;
  const logoPath = getLetterheadLogoPath();
  if (logoPath) {
    doc.image(logoPath, logoX, y, { fit: [logoBoxW, logoBoxH], align: 'left', valign: 'top' });
  } else {
    doc.roundedRect(logoX, y + 2, logoBoxW, logoBoxH, 6).lineWidth(1).strokeColor('#0b4f82').stroke();
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0b4f82').text('BG', logoX + 21, y + 18, { width: 44, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('PT. BINTANG GLOBAL GRUP', logoX + 3, y + 50, { width: logoBoxW - 6, align: 'center' });
  }

  const titleY = y + 2;
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0b4f82').text(COMPANY_NAME, headerX, titleY, { width: headerW, align: 'center' });
  const titleH = doc.heightOfString(COMPANY_NAME, { width: headerW, align: 'center' });
  const addressY = titleY + titleH + 4;
  doc.font('Helvetica').fontSize(9.2).fillColor('#111827').text(COMPANY_ADDRESS, headerX, addressY, { width: headerW, align: 'center' });
  const addressH = doc.heightOfString(COMPANY_ADDRESS, { width: headerW, align: 'center' });
  const contactY = addressY + addressH + 3;
  doc.font('Helvetica').fontSize(9.8).fillColor('#111827').text(COMPANY_CONTACT, headerX, contactY, { width: headerW, align: 'center' });
  const contactH = doc.heightOfString(COMPANY_CONTACT, { width: headerW, align: 'center' });

  const textBottom = contactY + contactH;
  const lineY = Math.max(textBottom + 8, margin + logoBoxH + 8);
  doc.moveTo(x, lineY).lineTo(x + pageWidth, lineY).lineWidth(2).strokeColor('#2f89c8').stroke();
  return lineY + 18;
}

module.exports = {
  drawCorporateLetterhead,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  COMPANY_CONTACT
};
