/**
 * Generate otomatis: isi provinsi.wilayah_id dan branch.provinsi_id yang masih null.
 * - Jika provinsi wilayah_id null → diisi sesuai mapping nama provinsi ke wilayah.
 * - Jika branch provinsi_id null → diisi dari kode cabang (Branch.code = Kabupaten.kode) atau nama kota (Branch.city ≈ Kabupaten.nama).
 * Menggunakan locationMaster.runFullSync() agar satu sumber kebenaran (dipakai juga oleh migration).
 * Jalankan: node scripts/sync-wilayah-provinsi-branch.js (dari folder backend)
 */
require('dotenv').config();
const path = require('path');

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const { runFullSync } = require(path.join(__dirname, '../src/utils/locationMaster'));

async function main() {
  try {
    console.log('Sync wilayah / provinsi / cabang (isi yang null)...\n');
    const result = await runFullSync();
    console.log('1. Provinsi: wilayah_id diisi untuk', result.provinsiUpdated, 'baris yang sebelumnya null.');
    console.log('2. Cabang: provinsi_id diisi dari kode (Branch.code = Kabupaten.kode) untuk', result.branchByCode, 'cabang.');
    console.log('3. Cabang: provinsi_id diisi dari kota (Branch.city/nama = Kabupaten.nama) untuk', result.branchByCity, 'cabang.');
    console.log('4. Cabang: provinsi_id diisi dari region (Branch.region = nama provinsi) untuk', result.branchByRegion || 0, 'cabang.');
    console.log('5. User: wilayah_id diisi dari Branch → Provinsi → Wilayah untuk', result.userWilayahUpdated || 0, 'user.');
    console.log('\nSelesai.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

main();
