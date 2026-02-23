/**
 * Generate example invoice PDFs per status (satu file per status)
 * Simpan di uploads/invoice-examples/ (folder opsional, bukan bagian workflow inti)
 *
 * Usage: node scripts/generate-invoice-examples.js
 */
const path = require('path');
const fs = require('fs');
const { buildInvoicePdfBuffer, STATUS_LABELS } = require('../src/utils/invoicePdf');
const { UPLOAD_ROOT } = require('../src/config/uploads');

const INVOICE_EXAMPLES_DIR = path.join(UPLOAD_ROOT, 'invoice-examples');
function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) { /* ignore */ }
  return dir;
}

const INVOICE_STATUSES = [
  'draft',
  'tentative',
  'partial_paid',
  'paid',
  'processing',
  'completed',
  'overdue',
  'canceled',
  'refunded',
  'order_updated',
  'overpaid',
  'overpaid_transferred',
  'overpaid_received',
  'refund_canceled',
  'overpaid_refund_pending'
];

function createSampleData(status) {
  const totalAmount = 45000000;
  const dpAmount = 13500000;
  const paidAmount = status === 'paid' || status === 'completed' ? totalAmount : (status === 'partial_paid' ? dpAmount : 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const overpaidAmount = ['overpaid', 'overpaid_transferred', 'overpaid_received', 'overpaid_refund_pending'].includes(status) ? 2500000 : 0;

  const now = new Date();
  const dueDateDp = new Date(now);
  dueDateDp.setDate(dueDateDp.getDate() + 3);

  return {
    id: '00000000-0000-0000-0000-000000000001',
    invoice_number: `INV-2025-${String(INVOICE_STATUSES.indexOf(status) + 1).padStart(5, '0')}`,
    order_id: '00000000-0000-0000-0000-000000000002',
    owner_id: '00000000-0000-0000-0000-000000000003',
    branch_id: '00000000-0000-0000-0000-000000000004',
    total_amount: totalAmount,
    dp_percentage: 30,
    dp_amount: dpAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    overpaid_amount: overpaidAmount,
    status,
    issued_at: now,
    due_date_dp: dueDateDp,
    created_at: now,
    updated_at: now,
    terms: [
      'Invoice batal otomatis bila dalam 24 jam setelah issued belum ada DP',
      'Minimal DP 30% dari total',
      'Jatuh tempo DP 3 hari setelah issued'
    ],
    Order: {
      order_number: 'ORD-2025-00001',
      total_amount: totalAmount,
      currency: 'IDR',
      OrderItems: [
        { product_name: 'Paket Umroh 9 Hari', total_price: 45000000 }
      ]
    },
    User: { name: 'Ahmad Wijaya', company_name: 'PT Travel Sejahtera' },
    Branch: { code: 'JKT', name: 'Jakarta Pusat' }
  };
}

async function main() {
  const outDir = ensureDir(INVOICE_EXAMPLES_DIR);
  console.log('Generating invoice examples to:', outDir);

  for (const status of INVOICE_STATUSES) {
    const data = createSampleData(status);
    const buf = await buildInvoicePdfBuffer(data);
    const filename = `invoice-${status}.pdf`;
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, buf);
    console.log(`  ✓ ${filename} (${STATUS_LABELS[status] || status})`);
  }

  console.log(`\nDone. ${INVOICE_STATUSES.length} files saved to uploads/invoice-examples/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
