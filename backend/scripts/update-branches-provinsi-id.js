/**
 * Isi provinsi_id pada tabel branches berdasarkan kolom region (nama provinsi).
 * Cabang akan muncul di filter saat user pilih wilayah/provinsi.
 * Jalankan: node scripts/update-branches-provinsi-id.js (dari folder backend)
 */
require('dotenv').config();
const path = require('path');

const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const { Branch, Provinsi } = require(path.join(__dirname, '../src/models'));

function normalizeName(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toUpperCase();
}

async function main() {
  try {
    const [branches] = await sequelize.query(
      'SELECT id, code, name, region, provinsi_id FROM branches'
    );
    const [provinces] = await sequelize.query(
      'SELECT id, name FROM provinsi'
    );
    console.log('Jumlah cabang:', (branches || []).length);
    console.log('Jumlah provinsi:', (provinces || []).length);
    if (!provinces || provinces.length === 0) {
      console.log('Tabel provinsi kosong. Jalankan seed master wilayah-provinsi dulu.');
      await sequelize.close();
      process.exit(1);
    }
    const provByNormName = {};
    provinces.forEach((p) => {
      const n = normalizeName(p.name);
      if (n) provByNormName[n] = p.id;
    });
    let updated = 0;
    const noMatch = [];
    for (const b of branches || []) {
      const regionNorm = normalizeName(b.region);
      if (!regionNorm) {
        if (b.region) noMatch.push({ code: b.code, region: b.region });
        continue;
      }
      const provinsiId = provByNormName[regionNorm] || null;
      if (provinsiId && b.provinsi_id !== provinsiId) {
        await sequelize.query(
          'UPDATE branches SET provinsi_id = :pid, updated_at = NOW() WHERE id = :id',
          { replacements: { pid: provinsiId, id: b.id } }
        );
        updated++;
      } else if (!provinsiId && b.region) {
        noMatch.push({ code: b.code, region: b.region, regionNorm });
      }
    }
    if (noMatch.length > 0) {
      console.log('Contoh region yang tidak match:', noMatch.slice(0, 5));
    }
    console.log('Cabang yang di-update provinsi_id:', updated);
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

main();
