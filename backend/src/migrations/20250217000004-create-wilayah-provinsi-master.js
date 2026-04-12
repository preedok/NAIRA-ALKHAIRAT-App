'use strict';

/**
 * Create master tables: wilayah, provinsi
 * Wilayah = region utama (Sumatra, Jawa, dll)
 * Provinsi = provinsi dengan FK ke wilayah
 *
 * Idempotent: aman jika data provinsi/wilayah sudah ada (deploy ulang / DB diselaraskan manual)
 * tanpa baris SequelizeMeta untuk migrasi ini.
 */
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const WILAYAH_DATA = [
  'Sumatra',
  'Jawa',
  'Kalimantan',
  'Sulawesi',
  'Bali-Nusa Tenggara',
  'Maluku',
  'Papua',
  'Lainnya'
];

const PROVINSI_DATA = [
  { kode: '11', nama: 'ACEH', wilayah: 'Sumatra' },
  { kode: '12', nama: 'SUMATERA UTARA', wilayah: 'Sumatra' },
  { kode: '13', nama: 'SUMATERA BARAT', wilayah: 'Sumatra' },
  { kode: '14', nama: 'RIAU', wilayah: 'Sumatra' },
  { kode: '15', nama: 'JAMBI', wilayah: 'Sumatra' },
  { kode: '16', nama: 'SUMATERA SELATAN', wilayah: 'Sumatra' },
  { kode: '17', nama: 'BENGKULU', wilayah: 'Sumatra' },
  { kode: '18', nama: 'LAMPUNG', wilayah: 'Sumatra' },
  { kode: '19', nama: 'KEPULAUAN BANGKA BELITUNG', wilayah: 'Sumatra' },
  { kode: '21', nama: 'KEPULAUAN RIAU', wilayah: 'Sumatra' },
  { kode: '31', nama: 'DKI JAKARTA', wilayah: 'Jawa' },
  { kode: '32', nama: 'JAWA BARAT', wilayah: 'Jawa' },
  { kode: '33', nama: 'JAWA TENGAH', wilayah: 'Jawa' },
  { kode: '34', nama: 'DAERAH ISTIMEWA YOGYAKARTA', wilayah: 'Jawa' },
  { kode: '35', nama: 'JAWA TIMUR', wilayah: 'Jawa' },
  { kode: '36', nama: 'BANTEN', wilayah: 'Jawa' },
  { kode: '51', nama: 'BALI', wilayah: 'Bali-Nusa Tenggara' },
  { kode: '52', nama: 'NUSA TENGGARA BARAT', wilayah: 'Bali-Nusa Tenggara' },
  { kode: '53', nama: 'NUSA TENGGARA TIMUR', wilayah: 'Bali-Nusa Tenggara' },
  { kode: '61', nama: 'KALIMANTAN BARAT', wilayah: 'Kalimantan' },
  { kode: '62', nama: 'KALIMANTAN TENGAH', wilayah: 'Kalimantan' },
  { kode: '63', nama: 'KALIMANTAN SELATAN', wilayah: 'Kalimantan' },
  { kode: '64', nama: 'KALIMANTAN TIMUR', wilayah: 'Kalimantan' },
  { kode: '65', nama: 'KALIMANTAN UTARA', wilayah: 'Kalimantan' },
  { kode: '71', nama: 'SULAWESI UTARA', wilayah: 'Sulawesi' },
  { kode: '72', nama: 'SULAWESI TENGAH', wilayah: 'Sulawesi' },
  { kode: '73', nama: 'SULAWESI SELATAN', wilayah: 'Sulawesi' },
  { kode: '74', nama: 'SULAWESI TENGGARA', wilayah: 'Sulawesi' },
  { kode: '75', nama: 'GORONTALO', wilayah: 'Sulawesi' },
  { kode: '76', nama: 'SULAWESI BARAT', wilayah: 'Sulawesi' },
  { kode: '81', nama: 'MALUKU', wilayah: 'Maluku' },
  { kode: '82', nama: 'MALUKU UTARA', wilayah: 'Maluku' },
  { kode: '91', nama: 'PAPUA', wilayah: 'Papua' },
  { kode: '92', nama: 'PAPUA BARAT', wilayah: 'Papua' },
  { kode: '93', nama: 'PAPUA SELATAN', wilayah: 'Papua' },
  { kode: '94', nama: 'PAPUA TENGAH', wilayah: 'Papua' },
  { kode: '95', nama: 'PAPUA PEGUNUNGAN', wilayah: 'Papua' },
  { kode: '96', nama: 'PAPUA BARAT DAYA', wilayah: 'Papua' }
];

async function tableExists(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :tableName LIMIT 1`,
    { replacements: { tableName } }
  );
  return rows.length > 0;
}

async function columnExists(queryInterface, tableName, columnName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :tableName AND column_name = :columnName LIMIT 1`,
    { replacements: { tableName, columnName } }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'wilayah'))) {
      await queryInterface.createTable('wilayah', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING(100), allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
    }

    if (!(await tableExists(queryInterface, 'provinsi'))) {
      await queryInterface.createTable('provinsi', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        kode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        wilayah_id: { type: Sequelize.UUID, references: { model: 'wilayah', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      });
    }

    for (const w of WILAYAH_DATA) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM wilayah WHERE name = :name LIMIT 1`,
        { replacements: { name: w } }
      );
      if (!existing.length) {
        const id = uuidv4();
        await queryInterface.bulkInsert('wilayah', [{
          id,
          name: w,
          created_at: new Date(),
          updated_at: new Date()
        }]);
      }
    }

    const [wilayahRows] = await queryInterface.sequelize.query(`SELECT id, name FROM wilayah`);
    const wilayahMap = {};
    for (const row of wilayahRows) {
      wilayahMap[row.name] = row.id;
    }

    for (const p of PROVINSI_DATA) {
      const wilayahId = wilayahMap[p.wilayah] || wilayahMap.Lainnya;
      await queryInterface.sequelize.query(
        `INSERT INTO provinsi (id, kode, name, wilayah_id, created_at, updated_at)
         VALUES (:id, :kode, :name, :wilayah_id, NOW(), NOW())
         ON CONFLICT (kode) DO NOTHING`,
        { replacements: { id: uuidv4(), kode: p.kode, name: p.nama, wilayah_id: wilayahId } }
      );
    }

    if (!(await columnExists(queryInterface, 'branches', 'provinsi_id'))) {
      await queryInterface.addColumn('branches', 'provinsi_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'provinsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('branches', 'provinsi_id');
    await queryInterface.dropTable('provinsi');
    await queryInterface.dropTable('wilayah');
  }
};
