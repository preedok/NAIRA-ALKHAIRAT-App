/**
 * Generate example payment proof PDF files agar bisa ditampilkan di aplikasi.
 * File disimpan di uploads/payment-proofs/ dengan nama yang sesuai seeder/database.
 *
 * Usage: node scripts/generate-payment-proof-examples.js
 */
const path = require('path');
const fs = require('fs');
const { buildPaymentProofPdfBuffer } = require('../src/utils/paymentProofPdf');
const { SUBDIRS, getDir } = require('../src/config/uploads');

// Data sesuai seeder 20250215000003-example-workflow.js
const PAYMENT_PROOFS = [
  {
    filename: 'BUKTI_INV-2026-00001_DP_1650000_IDR_20260215_120000.pdf',
    data: {
      invoice_number: 'INV-2026-00001',
      payment_type: 'dp',
      amount: 1650000,
      bank_name: 'BCA',
      account_number: '1234567890',
      transfer_date: '2026-02-15',
      notes: 'DP 30% - Order ORD-2026-00001'
    }
  },
  {
    filename: 'BUKTI_INV-2026-00002_partial_5500000_IDR_20260215_120000.pdf',
    data: {
      invoice_number: 'INV-2026-00002',
      payment_type: 'partial',
      amount: 5500000,
      bank_name: 'Mandiri',
      account_number: '0987654321',
      transfer_date: '2026-02-15',
      notes: 'Pembayaran sebagian - Order ORD-2026-00002'
    }
  },
  // Tambahan contoh untuk full payment
  {
    filename: 'BUKTI_INV-2026-00003_full_17500000_IDR_20260217_090000.pdf',
    data: {
      invoice_number: 'INV-2026-00003',
      payment_type: 'full',
      amount: 17500000,
      bank_name: 'BRI',
      account_number: '1122334455',
      transfer_date: '2026-02-17',
      notes: 'Pelunasan penuh'
    }
  }
];

async function main() {
  const outDir = getDir(SUBDIRS.PAYMENT_PROOFS);
  console.log('Generating payment proof examples to:', outDir);

  for (const { filename, data } of PAYMENT_PROOFS) {
    const buf = await buildPaymentProofPdfBuffer(data);
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, buf);
    console.log(`  ✓ ${filename} (${data.payment_type} - ${data.bank_name})`);
  }

  console.log(`\nDone. ${PAYMENT_PROOFS.length} files saved to uploads/payment-proofs/`);
  console.log('File bukti bayar sekarang dapat ditampilkan di tab Bukti Bayar pada Detail Invoice.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
