const { INVOICE_STATUS } = require('../constants');
const sequelize = require('../config/sequelize');

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

/**
 * Order yang status-nya `cancelled` tidak boleh muncul di Progress (invoice bisa masih non-cancel di DB).
 * @param {object} where - klausa where Sequelize untuk model Invoice
 * @param {import('sequelize').Op} Op
 */
function appendProgressExcludeCancelledOrders(where, Op) {
  if (!where || !Op) return;
  where[Op.and] = where[Op.and] || [];
  where[Op.and].push({
    order_id: {
      [Op.notIn]: sequelize.literal("(SELECT id FROM orders WHERE status = 'cancelled')")
    }
  });
}

module.exports = {
  PROGRESS_INVOICE_STATUS_BLOCKLIST,
  REFUND_STATUSES_HIDE_FROM_PROGRESS,
  appendProgressExcludeCancelledOrders
};
