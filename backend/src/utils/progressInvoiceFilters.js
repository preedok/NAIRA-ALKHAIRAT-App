const { INVOICE_STATUS } = require('../constants');

/**
 * Status invoice yang tidak ditampilkan di menu Progress divisi (hotel/visa/tiket/bus).
 * Termasuk: batal, refund (saldo/rekening), sumber pindahan overpaid ke invoice lain.
 */
const PROGRESS_INVOICE_STATUS_BLOCKLIST = [
  INVOICE_STATUS.CANCELED,
  INVOICE_STATUS.CANCELLED_REFUND,
  INVOICE_STATUS.REFUNDED,
  INVOICE_STATUS.REFUND_CANCELED,
  INVOICE_STATUS.OVERPAID_TRANSFERRED,
  INVOICE_STATUS.DRAFT
];

/** Invoice dengan refund aktif/menunggu/selesai tidak tampil di Progress. */
const REFUND_STATUSES_HIDE_FROM_PROGRESS = ['requested', 'approved', 'refunded'];

module.exports = {
  PROGRESS_INVOICE_STATUS_BLOCKLIST,
  REFUND_STATUSES_HIDE_FROM_PROGRESS
};
