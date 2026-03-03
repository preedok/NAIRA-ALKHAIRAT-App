/**
 * Seed master wilayah, provinsi, dan kabupaten/kota sekaligus.
 * Bisa dijalankan langsung: node scripts/seed-master-wilayah-provinsi-kabupaten.js (dari folder backend)
 */
require('dotenv').config();
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const { Wilayah, Provinsi, Kabupaten } = require(path.join(__dirname, '../src/models'));
const { getKabupatenByProvince } = require(path.join(__dirname, '../src/utils/indonesiaApi'));

const WILAYAH_DATA = [
  'Sumatra', 'Jawa', 'Kalimantan', 'Sulawesi',
  'Bali-Nusa Tenggara', 'Maluku', 'Papua', 'Lainnya'
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

async function main() {
  try {
    console.log('Seed master wilayah, provinsi, kabupaten...');

    let countWilayah = await Wilayah.count();
    if (countWilayah === 0) {
      console.log('  -> Insert wilayah...');
      for (const name of WILAYAH_DATA) {
        await Wilayah.create({ name });
      }
      console.log('  -> Wilayah:', WILAYAH_DATA.length, 'baris');
    } else {
      console.log('  -> Wilayah sudah ada:', countWilayah);
    }

    let countProvinsi = await Provinsi.count();
    if (countProvinsi === 0) {
      const wilayahList = await Wilayah.findAll({ attributes: ['id', 'name'] });
      const wilayahMap = {};
      wilayahList.forEach((w) => { wilayahMap[w.name] = w.id; });
      console.log('  -> Insert provinsi...');
      for (const p of PROVINSI_DATA) {
        const wilayahId = wilayahMap[p.wilayah] || wilayahMap['Lainnya'];
        await Provinsi.create({ kode: p.kode, name: p.nama, wilayah_id: wilayahId });
      }
      console.log('  -> Provinsi:', PROVINSI_DATA.length, 'baris');
    } else {
      console.log('  -> Provinsi sudah ada:', countProvinsi);
    }

    const provinsiList = await Provinsi.findAll({ attributes: ['id', 'kode'], order: [['kode', 'ASC']] });
    if (provinsiList.length === 0) {
      console.log('  -> Provinsi kosong, skip kabupaten.');
      await sequelize.close();
      process.exit(0);
      return;
    }

    const existingKabupaten = await Kabupaten.count();
    if (existingKabupaten > 0) {
      console.log('  -> Kabupaten sudah ada:', existingKabupaten, '(skip insert)');
      await sequelize.close();
      process.exit(0);
      return;
    }

    console.log('  -> Fetch kabupaten dari API dan insert...');
    let totalKab = 0;
    for (const prov of provinsiList) {
      let list = [];
      try {
        list = await getKabupatenByProvince(prov.kode);
      } catch (e) {
        console.warn('    Skip provinsi kode', prov.kode, ':', e.message);
        continue;
      }
      if (!Array.isArray(list) || list.length === 0) continue;
      const rows = list
        .map((k) => ({
          id: crypto.randomUUID(),
          kode: String(k.id || k.kode || '').trim(),
          nama: String(k.nama || k.name || '').trim(),
          provinsi_id: prov.id
        }))
        .filter((r) => r.kode && r.nama);
      if (rows.length > 0) {
        await Kabupaten.bulkCreate(rows);
        totalKab += rows.length;
      }
    }
    console.log('  -> Kabupaten:', totalKab, 'baris');

    await sequelize.close();
    console.log('Selesai.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

main();
