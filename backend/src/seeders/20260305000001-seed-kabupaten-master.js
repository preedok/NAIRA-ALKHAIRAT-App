'use strict';

/**
 * Seed master kabupaten/kota dari API data-indonesia
 * Memerlukan: tabel provinsi sudah terisi (migration 20250217000004)
 * Sumber: https://ibnux.github.io/data-indonesia/
 */
const https = require('https');
const crypto = require('crypto');

const BASE_URL = 'https://ibnux.github.io/data-indonesia';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT 1 FROM kabupaten LIMIT 1'
    );
    if (existing && existing.length > 0) {
      console.log('[seed kabupaten-master] Tabel kabupaten sudah berisi data. Skip.');
      return;
    }

    const [provinces] = await queryInterface.sequelize.query(
      'SELECT id, kode FROM provinsi ORDER BY kode'
    );
    if (!provinces || provinces.length === 0) {
      console.warn('[seed kabupaten-master] Tabel provinsi kosong. Jalankan migration wilayah-provinsi dulu.');
      return;
    }

    const now = new Date();
    let total = 0;

    for (const prov of provinces) {
      const kode = String(prov.kode || '').trim();
      if (!kode) continue;
      let list = [];
      try {
        list = await fetchJson(`${BASE_URL}/kabupaten/${kode}.json`);
      } catch (e) {
        console.warn(`[seed kabupaten-master] Skip provinsi kode ${kode}:`, e.message);
        continue;
      }
      if (!Array.isArray(list) || list.length === 0) continue;

      const rows = list.map((k) => ({
        id: crypto.randomUUID(),
        kode: String(k.id || k.kode || '').trim(),
        nama: String(k.nama || k.name || '').trim(),
        provinsi_id: prov.id,
        created_at: now,
        updated_at: now
      })).filter((r) => r.kode && r.nama);

      if (rows.length > 0) {
        await queryInterface.bulkInsert('kabupaten', rows);
        total += rows.length;
      }
    }

    console.log(`[seed kabupaten-master] ${total} kabupaten/kota berhasil dimasukkan.`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('kabupaten', null, {});
  }
};
