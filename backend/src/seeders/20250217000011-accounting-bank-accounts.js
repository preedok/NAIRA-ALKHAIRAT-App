'use strict';

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const BANK_ACCOUNTS = [
  { code: 'BSI-7236537999', bank_name: 'BSI', account_number: '7236537999', account_name: 'PT. BINTANG GLOBAL GRUP' },
  { code: 'BNI-1929941719', bank_name: 'BNI', account_number: '1929941719', account_name: 'PT. BINTANG GLOBAL GRUP' },
  { code: 'BRI-173901000308305', bank_name: 'BRI', account_number: '173901000308305', account_name: 'PT. BINTANG GLOBAL GRUP' }
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const b of BANK_ACCOUNTS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM accounting_bank_accounts WHERE code = '${b.code}' LIMIT 1`
      ).catch(() => [[]]);
      if (existing && existing.length > 0) continue;
      await queryInterface.bulkInsert('accounting_bank_accounts', [{
        id: uuidv4(),
        code: b.code,
        name: b.account_name,
        bank_name: b.bank_name,
        account_number: b.account_number,
        currency: 'IDR',
        is_active: true,
        created_at: now,
        updated_at: now
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accounting_bank_accounts', {
      code: BANK_ACCOUNTS.map((b) => b.code)
    });
  }
};
