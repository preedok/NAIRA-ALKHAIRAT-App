'use strict';

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const COA_DEFAULTS = [
  { code: '1', name: 'ASET', account_type: 'asset', level: 1, is_header: true, sort_order: 1 },
  { code: '1-1', name: 'Kas dan Bank', account_type: 'asset', level: 2, is_header: true, sort_order: 2 },
  { code: '1-1-01', name: 'Kas Kecil', account_type: 'asset', level: 3, is_header: false, sort_order: 3 },
  { code: '1-1-02', name: 'Bank BCA', account_type: 'asset', level: 3, is_header: false, sort_order: 4 },
  { code: '1-1-03', name: 'Bank Mandiri', account_type: 'asset', level: 3, is_header: false, sort_order: 5 },
  { code: '1-2', name: 'Piutang Usaha', account_type: 'asset', level: 2, is_header: true, sort_order: 6 },
  { code: '1-2-01', name: 'Piutang B2B', account_type: 'asset', level: 3, is_header: false, sort_order: 7 },
  { code: '2', name: 'KEWAJIBAN', account_type: 'liability', level: 1, is_header: true, sort_order: 10 },
  { code: '2-1', name: 'Hutang Usaha', account_type: 'liability', level: 2, is_header: true, sort_order: 11 },
  { code: '2-1-01', name: 'Hutang Vendor Hotel', account_type: 'liability', level: 3, is_header: false, sort_order: 12 },
  { code: '2-1-02', name: 'Hutang Vendor Bus', account_type: 'liability', level: 3, is_header: false, sort_order: 13 },
  { code: '2-2', name: 'Hutang Gaji', account_type: 'liability', level: 2, is_header: false, sort_order: 14 },
  { code: '3', name: 'EKUITAS', account_type: 'equity', level: 1, is_header: true, sort_order: 20 },
  { code: '3-1', name: 'Modal', account_type: 'equity', level: 2, is_header: false, sort_order: 21 },
  { code: '4', name: 'PENDAPATAN', account_type: 'revenue', level: 1, is_header: true, sort_order: 30 },
  { code: '4-1', name: 'Pendapatan Hotel', account_type: 'revenue', level: 2, is_header: false, sort_order: 31 },
  { code: '4-2', name: 'Pendapatan Visa', account_type: 'revenue', level: 2, is_header: false, sort_order: 32 },
  { code: '4-3', name: 'Pendapatan Tiket', account_type: 'revenue', level: 2, is_header: false, sort_order: 33 },
  { code: '4-4', name: 'Pendapatan Bus', account_type: 'revenue', level: 2, is_header: false, sort_order: 34 },
  { code: '4-5', name: 'Pendapatan Handling', account_type: 'revenue', level: 2, is_header: false, sort_order: 35 },
  { code: '5', name: 'BEBAN', account_type: 'expense', level: 1, is_header: true, sort_order: 40 },
  { code: '5-1', name: 'HPP Hotel', account_type: 'expense', level: 2, is_header: false, sort_order: 41 },
  { code: '5-2', name: 'HPP Visa', account_type: 'expense', level: 2, is_header: false, sort_order: 42 },
  { code: '5-3', name: 'HPP Tiket', account_type: 'expense', level: 2, is_header: false, sort_order: 43 },
  { code: '5-4', name: 'HPP Bus', account_type: 'expense', level: 2, is_header: false, sort_order: 44 },
  { code: '5-5', name: 'Beban Gaji', account_type: 'expense', level: 2, is_header: false, sort_order: 45 }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const year = now.getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const fyCode = `FY${year}`;

    // Skip if fiscal year already exists (idempotent)
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM accounting_fiscal_years WHERE code = '${fyCode}' LIMIT 1`
    ).catch(() => [[]]);
    if (existing && existing.length > 0) {
      console.log(`Seeder: ${fyCode} already exists, skipping accounting-defaults.`);
      return;
    }

    const fyId = uuidv4();
    await queryInterface.bulkInsert('accounting_fiscal_years', [{
      id: fyId,
      code: fyCode,
      name: `Tahun Fiskal ${year}`,
      start_date: startDate,
      end_date: endDate,
      is_closed: false,
      created_at: now,
      updated_at: now
    }]);

    const periods = [];
    for (let m = 1; m <= 12; m++) {
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0);
      periods.push({
        id: uuidv4(),
        fiscal_year_id: fyId,
        period_number: m,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        is_locked: false,
        created_at: now,
        updated_at: now
      });
    }
    await queryInterface.bulkInsert('accounting_periods', periods);

    const coaMap = {};
    const coaRows = [];
    for (const a of COA_DEFAULTS) {
      const id = uuidv4();
      coaMap[a.code] = id;
      const parentId = a.code.includes('-') ? (coaMap[a.code.split('-').slice(0, -1).join('-')] || null) : null;
      coaRows.push({
        id,
        parent_id: parentId,
        code: a.code,
        name: a.name,
        account_type: a.account_type,
        level: a.level,
        is_header: a.is_header,
        currency: 'IDR',
        is_active: true,
        sort_order: a.sort_order,
        created_at: now,
        updated_at: now
      });
    }
    await queryInterface.bulkInsert('chart_of_accounts', coaRows);

    const mappingTypes = [
      { type: 'sales_hotel', debit: '1-2-01', credit: '4-1' },
      { type: 'sales_visa', debit: '1-2-01', credit: '4-2' },
      { type: 'sales_ticket', debit: '1-2-01', credit: '4-3' },
      { type: 'sales_bus', debit: '1-2-01', credit: '4-4' },
      { type: 'sales_handling', debit: '1-2-01', credit: '4-5' },
      { type: 'purchase_hotel', debit: '5-1', credit: '2-1-01' },
      { type: 'purchase_bus', debit: '5-4', credit: '2-1-02' },
      { type: 'payroll', debit: '5-5', credit: '2-2' },
      { type: 'cash_receipt', debit: '1-1-01', credit: '1-2-01' }
    ];
    const mappings = mappingTypes.map(m => ({
      id: uuidv4(),
      mapping_type: m.type,
      debit_account_id: coaMap[m.debit],
      credit_account_id: coaMap[m.credit],
      description: `Auto mapping ${m.type}`,
      is_active: true,
      created_at: now,
      updated_at: now
    }));
    await queryInterface.bulkInsert('account_mappings', mappings);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('account_mappings', {});
    await queryInterface.bulkDelete('chart_of_accounts', {});
    await queryInterface.bulkDelete('accounting_periods', {});
    await queryInterface.bulkDelete('accounting_fiscal_years', {});
  }
};
