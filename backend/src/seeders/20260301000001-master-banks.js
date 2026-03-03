'use strict';

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/** Master data bank: Indonesia (umum + syariah) + Saudi (untuk transfer/pembayaran) */
const BANKS = [
  // Bank Umum Persero
  { code: 'BRI', name: 'Bank Rakyat Indonesia (BRI)' },
  { code: 'BNI', name: 'Bank Negara Indonesia (BNI)' },
  { code: 'MANDIRI', name: 'Bank Mandiri' },
  { code: 'BTN', name: 'Bank Tabungan Negara (BTN)' },
  // Bank Swasta Nasional
  { code: 'BCA', name: 'Bank Central Asia (BCA)' },
  { code: 'CIMB', name: 'CIMB Niaga' },
  { code: 'PERMATA', name: 'Bank Permata' },
  { code: 'DANAMON', name: 'Bank Danamon' },
  { code: 'OCBC', name: 'OCBC NISP' },
  { code: 'PANIN', name: 'Bank Panin' },
  { code: 'MEGA', name: 'Bank Mega' },
  { code: 'BUKOPIN', name: 'Bank Bukopin' },
  { code: 'MAYBANK', name: 'Bank Maybank Indonesia' },
  { code: 'UOB', name: 'Bank UOB Indonesia' },
  { code: 'BTPN', name: 'Bank BTPN' },
  { code: 'HSBC', name: 'HSBC Indonesia' },
  { code: 'CITIBANK', name: 'Citibank Indonesia' },
  { code: 'STANDARD', name: 'Standard Chartered' },
  { code: 'ANZ', name: 'ANZ Indonesia' },
  { code: 'COMMONWEALTH', name: 'Bank Commonwealth' },
  { code: 'DBS', name: 'DBS Bank Indonesia' },
  { code: 'CAPITAL', name: 'Bank Capital Indonesia' },
  { code: 'JTRUST', name: 'Bank J Trust Indonesia' },
  { code: 'SHINHAN', name: 'Bank Shinhan Indonesia' },
  { code: 'WOORI', name: 'Bank Woori Saudara' },
  { code: 'CTBC', name: 'Bank CTBC Indonesia' },
  { code: 'MNC', name: 'Bank MNC Internasional' },
  { code: 'BUMI', name: 'Bank Bumi Arta' },
  { code: 'HANA', name: 'Bank Hana' },
  { code: 'ICBC', name: 'Bank ICBC Indonesia' },
  { code: 'BANK_CHINA', name: 'Bank of China' },
  { code: 'MUAMALAT', name: 'Bank Muamalat' },
  // Bank Syariah
  { code: 'BSI', name: 'Bank Syariah Indonesia (BSI)' },
  { code: 'BRI_SYARIAH', name: 'BRIsyariah' },
  { code: 'BNI_SYARIAH', name: 'BNI Syariah' },
  { code: 'MANDIRI_SYARIAH', name: 'Bank Mandiri Syariah' },
  { code: 'BCA_SYARIAH', name: 'BCA Syariah' },
  { code: 'CIMB_SYARIAH', name: 'CIMB Niaga Syariah' },
  { code: 'PANIN_SYARIAH', name: 'Bank Panin Dubai Syariah' },
  { code: 'MEGA_SYARIAH', name: 'Bank Mega Syariah' },
  { code: 'BJB_SYARIAH', name: 'Bank BJB Syariah' },
  // BPD / Bank Daerah
  { code: 'BJB', name: 'Bank BJB' },
  { code: 'BPD_JABAR', name: 'Bank BJB' },
  { code: 'BPD_DKI', name: 'Bank DKI' },
  { code: 'BPD_JATIM', name: 'Bank Jatim' },
  { code: 'BPD_JATENG', name: 'Bank Jateng' },
  { code: 'BPD_SULSEL', name: 'Bank Sulselbar' },
  { code: 'BPD_SUMATERA', name: 'Bank Sumut' },
  { code: 'BPD_KALBAR', name: 'Bank Kalbar' },
  { code: 'BPD_KALSEL', name: 'Bank Kalsel' },
  { code: 'BPD_KALTIM', name: 'Bank Kaltim' },
  { code: 'BPD_SULTENG', name: 'Bank Sulteng' },
  { code: 'BPD_SULTRA', name: 'Bank Sultra' },
  { code: 'BPD_NTB', name: 'Bank NTB' },
  { code: 'BPD_BALI', name: 'Bank Bali' },
  { code: 'BPD_ACEH', name: 'Bank Aceh' },
  { code: 'BPD_RIAU', name: 'Bank Riau Kepri' },
  { code: 'BPD_SUMBAR', name: 'Bank Nagari' },
  { code: 'BPD_LAMPUNG', name: 'Bank Lampung' },
  { code: 'BPD_BABEL', name: 'Bank Babel' },
  { code: 'BPD_BENGKULU', name: 'Bank Bengkulu' },
  { code: 'BPD_JAMBI', name: 'Bank Jambi' },
  { code: 'BPD_SUMSEL', name: 'Bank Sumsel Babel' },
  { code: 'BPD_GORONTALO', name: 'Bank Gorontalo' },
  { code: 'BPD_MALUKU', name: 'Bank Maluku' },
  { code: 'BPD_PAPUA', name: 'Bank Papua' },
  // Saudi Arabia (untuk pembayaran/transfer dari Saudi)
  { code: 'ALRAJHI', name: 'Al Rajhi Bank' },
  { code: 'SNB', name: 'Saudi National Bank (SNB)' },
  { code: 'RIYAD', name: 'Riyad Bank' },
  { code: 'ALINMA', name: 'Alinma Bank' },
  { code: 'ALBILAD', name: 'Al Bilad Bank' },
  { code: 'ARAB_NATIONAL', name: 'Arab National Bank' },
  { code: 'SAAB', name: 'Saudi Awwal Bank' },
  { code: 'BANQUE_SAUDI', name: 'Banque Saudi Fransi' },
  // Lainnya
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
