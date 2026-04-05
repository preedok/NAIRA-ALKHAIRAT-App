/**
 * Konfigurasi penyimpanan file: root di PROJECT ROOT (bukan di dalam backend).
 * Struktur folder di bawah uploads/ agar file mudah dicari menurut jenis dan konteks.
 *
 * Struktur:
 *   uploads/
 *   ├── mou/                 MoU yang sudah ditandatangani owner
 *   ├── payment-proofs/      Bukti pembayaran (DP / pelunasan)
 *   ├── manifest/            Manifest jamaah (visa/tiket) per order
 *   │   ├── visa/
 *   │   └── ticket/
 *   ├── visa-docs/           Dokumen visa terbit (role visa upload)
 *   ├── ticket-docs/         Dokumen tiket terbit (role ticket upload)
 *   ├── invoices/            PDF invoice yang digenerate
 *
 * Format nama file (mudah dibaca dan dicari):
 *   - mou:           MOU_Owner_{userId}_YYYYMMDD_HHmmss.{ext}
 *   - payment-proof: BUKTI_{invoiceNumber}_{tipe}_{nominal}_IDR_YYYYMMDD_HHmmss.{ext}
 *   - visa-doc:      VISA_ORD-XXXX-XXXXX_{orderItemId6}_YYYYMMDD_HHmmss.{ext}
 *   - ticket-doc:    TIKET_ORD-XXXX-XXXXX_{orderItemId6}_YYYYMMDD_HHmmss.{ext}
 *   - siskopatuh-doc: SISKOPATUH_ORD-XXXX-XXXXX_{orderItemId6}_YYYYMMDD_HHmmss.{ext}
 *   - manifest:      MANIFEST_VISA_ORD-XXXX-XXXXX_YYYYMMDD.{ext} atau MANIFEST_TIKET_...
 */

const path = require('path');
const fs = require('fs');

// Root folder uploads ada di project root (satu tingkat di atas backend)
const BACKEND_ROOT = path.join(__dirname, '../..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const UPLOAD_ROOT = path.join(PROJECT_ROOT, 'uploads');

const SUBDIRS = {
  MOU: 'mou',
  REGISTRATION_PAYMENT: 'registration-payment',
  PAYMENT_PROOFS: 'payment-proofs',
  MANIFEST_VISA: 'manifest/visa',
  MANIFEST_TICKET: 'manifest/ticket',
  VISA_DOCS: 'visa-docs',
  TICKET_DOCS: 'ticket-docs',
  HOTEL_DOCS: 'hotel-docs',
  JAMAAH_DATA: 'jamaah-data',
  INVOICES: 'invoices',
  REFUND_PROOFS: 'refund-proofs',
  PURCHASE_PROOFS: 'purchase-proofs',
  BUS_TICKET_DOCS: 'bus-ticket-docs',
  SISKOPATUH_DOCS: 'siskopatuh-docs'
};

function getDir(subdir) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
  return dir;
}

function dateTimeForFilename() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const time = d.toTimeString().slice(0, 8).replace(/:/g, '');
  return { date, time };
}

function safeExt(originalName, defaultExt = '.pdf') {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext && /^\.(pdf|jpg|jpeg|png|doc|docx|xls|xlsx|zip)$/.test(ext) ? ext : defaultExt;
}

function jamaahDataFilename(orderNumber, orderItemId, originalName) {
  const { date, time } = dateTimeForFilename();
  const ord = (orderNumber || 'ORD').replace(/[^a-zA-Z0-9-]/g, '_');
  const id6 = (orderItemId || '').toString().slice(-6);
  const ext = path.extname(originalName || '').toLowerCase() === '.zip' ? '.zip' : safeExt(originalName, '.zip');
  return `JAMAAH_${ord}_${id6}_${date}_${time}${ext}`;
}

/**
 * Nama file MoU: MOU_Owner_{userId}_YYYYMMDD_HHmmss.pdf
 */
function mouFilename(userId, companySlug, originalName) {
  const { date, time } = dateTimeForFilename();
  const slug = (companySlug || userId || 'owner').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const ext = safeExt(originalName);
  return `MOU_Owner_${slug}_${date}_${time}${ext}`;
}

/** Nama file bukti bayar pendaftaran: REG_Owner_{userId6}_{date}_{time}.pdf */
function registrationPaymentFilename(userId, originalName) {
  const { date, time } = dateTimeForFilename();
  const id6 = (userId || '').toString().slice(-6);
  const ext = safeExt(originalName);
  return `REG_Owner_${id6}_${date}_${time}${ext}`;
}

/** Nama file bukti bayar saat registrasi (belum ada userId): REG_Register_{date}_{time}.ext */
function registrationPaymentFilenameAtRegister(originalName) {
  const { date, time } = dateTimeForFilename();
  const ext = safeExt(originalName);
  return `REG_Register_${date}_${time}${ext}`;
}

/**
 * Nama file bukti bayar: BUKTI_{invoiceNumber}_{tipe}_{nominal}_IDR_YYYYMMDD_HHmmss.pdf
 */
function paymentProofFilename(invoiceNumber, paymentType, amount, originalName) {
  const { date, time } = dateTimeForFilename();
  const safeNum = (invoiceNumber || 'INV').replace(/[^a-zA-Z0-9-]/g, '_');
  const nominal = Number(amount) || 0;
  const ext = safeExt(originalName);
  return `BUKTI_${safeNum}_${paymentType || 'dp'}_${nominal}_IDR_${date}_${time}${ext}`;
}

/**
 * Nama file dokumen visa: VISA_ORD-XXXX-XXXXX_{orderItemId6}_YYYYMMDD_HHmmss.pdf
 * orderItemId6 = 6 karakter terakhir UUID
 */
function visaDocFilename(orderNumber, orderItemId, originalName) {
  const { date, time } = dateTimeForFilename();
  const ord = (orderNumber || 'ORD').replace(/[^a-zA-Z0-9-]/g, '_');
  const id6 = (orderItemId || '').toString().slice(-6);
  const ext = safeExt(originalName);
  return `VISA_${ord}_${id6}_${date}_${time}${ext}`;
}

/**
 * Nama file dokumen tiket: TIKET_ORD-XXXX-XXXXX_{orderItemId6}_YYYYMMDD_HHmmss.pdf
 */
function ticketDocFilename(orderNumber, orderItemId, originalName) {
  const { date, time } = dateTimeForFilename();
  const ord = (orderNumber || 'ORD').replace(/[^a-zA-Z0-9-]/g, '_');
  const id6 = (orderItemId || '').toString().slice(-6);
  const ext = safeExt(originalName);
  return `TIKET_${ord}_${id6}_${date}_${time}${ext}`;
}

/** Dokumen siskopatuh selesai (divisi upload): SISKOPATUH_ORD-..._{orderItemId6}_YYYYMMDD_HHmmss.{ext} */
function siskopatuhDocFilename(orderNumber, orderItemId, originalName) {
  const { date, time } = dateTimeForFilename();
  const ord = (orderNumber || 'ORD').replace(/[^a-zA-Z0-9-]/g, '_');
  const id6 = (orderItemId || '').toString().slice(-6);
  const ext = safeExt(originalName);
  return `SISKOPATUH_${ord}_${id6}_${date}_${time}${ext}`;
}

/**
 * Nama file dokumen info hotel (auto-generate): HOTEL_{invoiceNumber}_{orderItemId6}_YYYYMMDD_HHmmss.pdf
 */
function hotelDocFilename(invoiceNumber, orderItemId) {
  const { date, time } = dateTimeForFilename();
  const inv = (invoiceNumber || 'INV').replace(/[^a-zA-Z0-9-]/g, '_');
  const id6 = (orderItemId || '').toString().slice(-6);
  return `HOTEL_${inv}_${id6}_${date}_${time}.pdf`;
}

/**
 * Nama file invoice PDF: INV_{invoiceNumber}_{status}_YYYYMMDD_HHmmss.pdf
 */
function invoiceFilename(invoiceNumber, status) {
  const { date, time } = dateTimeForFilename();
  const safeNum = (invoiceNumber || 'INV').replace(/[^a-zA-Z0-9-]/g, '_');
  const safeStatus = (status || 'draft').replace(/[^a-zA-Z0-9_]/g, '_');
  return `INV_${safeNum}_${safeStatus}_${date}_${time}.pdf`;
}

/** Nama file bukti pembelian (faktur pembelian): BUKTI_PURCHASE_{invoiceNumber}_YYYYMMDD_HHmmss.{ext} */
function purchaseProofFilename(invoiceNumber, originalName) {
  const { date, time } = dateTimeForFilename();
  const inv = (invoiceNumber || 'INVP').replace(/[^a-zA-Z0-9-]/g, '_');
  const ext = safeExt(originalName);
  return `BUKTI_PURCHASE_${inv}_${date}_${time}${ext}`;
}

/** Nama file bukti PO: BUKTI_PO_{poNumber}_YYYYMMDD_HHmmss.{ext} */
function purchaseOrderProofFilename(poNumber, originalName) {
  const { date, time } = dateTimeForFilename();
  const po = (poNumber || 'PO').replace(/[^a-zA-Z0-9-]/g, '_');
  const ext = safeExt(originalName);
  return `BUKTI_PO_${po}_${date}_${time}${ext}`;
}

/** Nama file bukti refund: REFUND_{refundId6}_{invoiceNumber}_YYYYMMDD_HHmmss.{ext} */
function refundProofFilename(refundId, invoiceNumber, originalName) {
  const { date, time } = dateTimeForFilename();
  const id6 = (refundId || '').toString().slice(-6);
  const inv = (invoiceNumber || 'INV').replace(/[^a-zA-Z0-9-]/g, '_');
  const ext = safeExt(originalName);
  return `REFUND_${id6}_${inv}_${date}_${time}${ext}`;
}

/**
 * URL path untuk akses file dari API (tanpa host). Contoh: /uploads/mou/MOU_Owner_xxx.pdf
 */
function toUrlPath(subdir, filename) {
  const segment = subdir.replace(/\\/g, '/');
  return `/uploads/${segment}/${filename}`;
}

module.exports = {
  UPLOAD_ROOT,
  PROJECT_ROOT,
  SUBDIRS,
  getDir,
  dateTimeForFilename,
  safeExt,
  mouFilename,
  paymentProofFilename,
  visaDocFilename,
  ticketDocFilename,
  siskopatuhDocFilename,
  hotelDocFilename,
  jamaahDataFilename,
  invoiceFilename,
  refundProofFilename,
  purchaseProofFilename,
  purchaseOrderProofFilename,
  registrationPaymentFilename,
  registrationPaymentFilenameAtRegister,
  toUrlPath
};
