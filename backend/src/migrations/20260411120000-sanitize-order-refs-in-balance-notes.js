'use strict';

/**
 * Normalisasi catatan transaksi saldo: hilangkan segmen "order ORD-…".
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `UPDATE owner_balance_transactions SET notes = regexp_replace(notes, $1::text, $2::text, 'gi')
       WHERE notes IS NOT NULL AND notes LIKE '%Pembatalan order ORD-%'`,
      { bind: ['Pembatalan order ORD-[A-Za-z0-9-]+;\\s*invoice\\s+', 'Pembatalan invoice '] }
    );
    await sequelize.query(
      `UPDATE owner_balance_transactions SET notes = regexp_replace(notes, $1::text, $2::text, 'g')
       WHERE notes IS NOT NULL AND notes LIKE '%Pembatalan order ORD-%'`,
      { bind: ['Pembatalan order ORD-[A-Za-z0-9-]+;\\s*', 'Pembatalan invoice; '] }
    );
    await sequelize.query(
      `UPDATE owner_balance_transactions SET notes = regexp_replace(notes, $1::text, $2::text, 'g')
       WHERE notes IS NOT NULL AND notes LIKE '%(order ORD-%'`,
      { bind: ['\\(order ORD-[A-Za-z0-9-]+;\\s*', '('] }
    );
  },

  async down() {}
};
