/**
 * Generate single PDF: WORKFLOW PROSES BISNIS - Bintang Global Group
 * Usage: node backend/scripts/generate-workflow-pdf.js
 * Output: docs/WORKFLOW_PROSES_BISNIS_PRESENTASI.pdf
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const MARGIN = 50;
const PAGE_W = 595;
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

const mdPath = path.join(__dirname, '../../docs/WORKFLOW_PROSES_BISNIS_PRESENTASI.md');
const outPath = path.join(__dirname, '../../docs/WORKFLOW_PROSES_BISNIS_PRESENTASI.pdf');

if (!fs.existsSync(mdPath)) {
  console.error('File not found:', mdPath);
  process.exit(1);
}

const raw = fs.readFileSync(mdPath, 'utf8');

function parseBlocks(raw) {
  const blocks = [];
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '').trim() });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '').trim() });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '').trim() });
      i++;
      continue;
    }
    if (line.startsWith('|') && (lines[i + 1] || '').match(/^\|?[-:\s|]+\|?$/)) {
      const tableRows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'table', rows: tableRows });
      continue;
    }
    if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
      const listItems = [];
      while (i < lines.length && (lines[i].match(/^[-*]\s+/) || lines[i].match(/^\d+\.\s+/) || (lines[i].startsWith('  ') && listItems.length))) {
        listItems.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'list', items: listItems });
      continue;
    }
    if (line.trim() === '' && blocks.length && blocks[blocks.length - 1].type === 'para') {
      blocks[blocks.length - 1].text += '\n\n';
      i++;
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.trim() === '---') {
      i++;
      continue;
    }
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('|') && !lines[i].match(/^[-*]\s+/) && !lines[i].match(/^\d+\.\s+/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) blocks.push({ type: 'para', text: paraLines.join('\n').trim() });
  }
  return blocks;
}

function addPageIfNeeded(doc, needed) {
  if (doc.y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

function drawBlock(doc, block) {
  const lineHeight = 14;
  const smallGap = 6;
  const medGap = 10;

  if (block.type === 'h1') {
    addPageIfNeeded(doc, 50);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a1a').text(block.text, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor('black');
    return;
  }
  if (block.type === 'h2') {
    addPageIfNeeded(doc, 36);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c5282').text(block.text);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('black');
    return;
  }
  if (block.type === 'h3') {
    addPageIfNeeded(doc, 28);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2d3748').text(block.text);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(11).fillColor('black');
    return;
  }
    if (block.type === 'para') {
      let text = block.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      const height = doc.heightOfString(text, { width: CONTENT_W }) + smallGap;
      addPageIfNeeded(doc, height);
      doc.fontSize(10).text(text, { width: CONTENT_W, align: 'left', lineGap: 2 });
    doc.moveDown(0.3);
    return;
  }
  if (block.type === 'list') {
    block.items.forEach(item => {
      let text = item.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // strip [text](url) -> text
      const h = doc.heightOfString('• ' + text, { width: CONTENT_W - 15 }) + 2;
      addPageIfNeeded(doc, h);
      doc.fontSize(10).text('• ' + text, { width: CONTENT_W - 15, indent: 15, lineGap: 1 });
    });
    doc.moveDown(0.2);
    return;
  }
  if (block.type === 'table') {
    doc.font('Helvetica').fontSize(9);
    const rows = block.rows;
    const colCount = (rows[0].match(/\|/g) || []).length - (rows[0].trim().startsWith('|') ? 0 : 1);
    const isHeader = rows.length > 1 && rows[1].replace(/\s/g, '').replace(/-/g, '').length === 0;
    const dataRows = isHeader ? rows.slice(2) : rows;
    const headerCells = rows[0].split('|').map(c => c.trim()).filter(Boolean);
    const cellW = (CONTENT_W - 20) / (headerCells.length || 1);
    const rowH = 18;
    addPageIfNeeded(doc, rowH * (dataRows.length + 1) + 30);
    doc.font('Helvetica-Bold').fontSize(9);
    let x = MARGIN;
    headerCells.forEach(cell => {
      doc.rect(x, doc.y, cellW, rowH).stroke();
      doc.text(cell.substring(0, 22), x + 4, doc.y + 4, { width: cellW - 8, height: rowH - 6 });
      x += cellW;
    });
    doc.y += rowH;
    doc.font('Helvetica').fontSize(8);
    dataRows.forEach(row => {
      addPageIfNeeded(doc, rowH);
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      let x = MARGIN;
      cells.forEach(cell => {
        doc.rect(x, doc.y, cellW, rowH).stroke();
        doc.text(cell.substring(0, 28), x + 4, doc.y + 4, { width: cellW - 8, height: rowH - 6 });
        x += cellW;
      });
      doc.y += rowH;
    });
    doc.moveDown(0.5);
  }
}

const blocks = parseBlocks(raw);
const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

doc.fontSize(11).font('Helvetica');
blocks.forEach(block => drawBlock(doc, block));

doc.end();
stream.on('finish', () => {
  console.log('PDF written:', outPath);
});
stream.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
