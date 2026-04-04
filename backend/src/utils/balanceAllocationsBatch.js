const { Op } = require('sequelize');
const { OwnerBalanceTransaction } = require('../models');

function mapBalanceAllocRow(r) {
  return {
    id: r.id,
    amount: Math.abs(Math.min(0, parseFloat(r.amount) || 0)),
    notes: r.notes || null,
    created_at: r.created_at
  };
}

/** Map invoice_id → array alokasi saldo (urut created_at), untuk list progress divisi & sejenisnya. */
async function balanceAllocationsByInvoiceId(invoiceIds) {
  if (!invoiceIds || invoiceIds.length === 0) return {};
  const rows = await OwnerBalanceTransaction.findAll({
    where: { reference_type: 'invoice', reference_id: { [Op.in]: invoiceIds }, type: 'allocation' },
    attributes: ['id', 'reference_id', 'amount', 'notes', 'created_at'],
    order: [['created_at', 'ASC']],
    raw: true
  });
  return rows.reduce((acc, r) => {
    const invId = r.reference_id;
    if (!acc[invId]) acc[invId] = [];
    acc[invId].push(mapBalanceAllocRow(r));
    return acc;
  }, {});
}

module.exports = { mapBalanceAllocRow, balanceAllocationsByInvoiceId };
