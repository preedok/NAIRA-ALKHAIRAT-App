/**
 * Sinkronisasi lokasi dari data master: Wilayah → Provinsi → Kabupaten (Kota).
 * - Branch: isi provinsi_id dari Branch.code (kode kabupaten) jika masih null.
 * Digunakan setelah seed:kabupaten agar cabang terhubung ke provinsi/wilayah.
 * Jalankan: node scripts/sync-location-from-master.js (dari folder backend)
 * Atau: npm run sync:location
 */
require('dotenv').config();
const path = require('path');

const { syncAllBranchesProvinsiFromMaster } = require(path.join(__dirname, '../src/utils/locationMaster'));

async function main() {
  try {
    require(path.join(__dirname, '../src/config/sequelize'));
    const result = await syncAllBranchesProvinsiFromMaster();
    console.log('[sync-location-from-master] Cabang dengan code tapi provinsi_id null:', result.total);
    console.log('[sync-location-from-master] Cabang yang di-update provinsi_id:', result.updated);
    process.exit(0);
  } catch (err) {
    console.error('[sync-location-from-master] Error:', err.message);
    process.exit(1);
  }
}

main();
