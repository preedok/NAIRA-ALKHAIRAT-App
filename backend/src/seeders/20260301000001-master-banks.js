'use strict';

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const BANKS = [
  { code: 'BSI', name: 'BSI' },
  { code: 'BNI', name: 'BNI' },
  { code: 'BRI', name: 'BRI' },
  { code: 'BCA', name: 'BCA' },
  { code: 'MANDIRI', name: 'Bank Mandiri' },
  { code: 'CIMB', name: 'CIMB Niaga' },
  { code: 'PERMATA', name: 'Bank Permata' },
  { code: 'BUKOPIN', name: 'Bank Bukopin' },
  { code: 'BTN', name: 'Bank BTN' },
  { code: 'DANAMON', name: 'Bank Danamon' },
  { code: 'OCBC', name: 'OCBC NISP' },
  { code: 'PANIN', name: 'Bank Panin' },
  { code: 'MEGA', name: 'Bank Mega' },
  { code: 'BJB', name: 'Bank BJB' },
  { code: 'BPD', name: 'Bank BPD' },
  { code: 'ALRAJHI', name: 'Al Rajhi Bank' },
  { code: 'SNB', name: 'Saudi National Bank' },
  { code: 'RIYAD', name: 'Riyad Bank' },
  { code: 'ALINMA', name: 'Alinma Bank' },
  { code: 'OTHER', name: 'Lainnya' }
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (let i = 0; i < BANKS.length; i++) {
      const b = BANKS[i];
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM banks WHERE code = '${b.code}' LIMIT 1`
      ).catch(() => [[]]);
      if (existing && existing.length > 0) continue;
      await queryInterface.bulkInsert('banks', [{
        id: uuidv4(),
        code: b.code,
        name: b.name,
        is_active: true,
        sort_order: i + 1,
        created_at: now,
        updated_at: now
      }]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('banks', {
      code: BANKS.map((b) => b.code)
    });
  }
};
