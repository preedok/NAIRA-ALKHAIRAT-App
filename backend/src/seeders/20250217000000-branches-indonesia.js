'use strict';

/**
 * Seeder: Data cabang seluruh kabupaten dan kota di Indonesia
 * Sumber data: https://ibnux.github.io/data-indonesia/ (data BPS/Kemendagri)
 * Menambah ~514 kabupaten/kota ke tabel branches (tidak menghapus data demo yang ada)
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

function formatBranchName(nama) {
  if (!nama || typeof nama !== 'string') return nama;
  const s = nama.trim().toUpperCase();
  if (s.startsWith('KAB.')) {
    const rest = s.replace(/^KAB\.\s*/, '').trim();
    return 'Kabupaten ' + rest.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }
  if (s.startsWith('KOTA')) {
    const rest = s.replace(/^KOTA\s*(ADM\.\s*)?/, '').trim();
    return 'Kota ' + rest.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }
  return nama;
}

function extractCity(nama) {
  if (!nama || typeof nama !== 'string') return nama;
  const s = nama.trim().toUpperCase();
  if (s.startsWith('KAB.')) return s.replace(/^KAB\.\s*/, '').trim().split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  if (s.startsWith('KOTA')) return s.replace(/^KOTA\s*(ADM\.\s*)?/, '').trim().split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  return nama;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const branches = [];

    try {
      const provinces = await fetchJson(`${BASE_URL}/provinsi.json`);
      if (!Array.isArray(provinces) || provinces.length === 0) {
        console.warn('[seed branches-indonesia] Tidak ada data provinsi.');
        return;
      }

      for (const prov of provinces) {
        const provId = prov.id || prov.nama;
        const region = (prov.nama || '').trim();
        let kabupatenList = [];
        try {
          kabupatenList = await fetchJson(`${BASE_URL}/kabupaten/${provId}.json`);
        } catch (e) {
          console.warn(`[seed branches-indonesia] Skip provinsi ${region} (${provId}):`, e.message);
          continue;
        }
        if (!Array.isArray(kabupatenList)) continue;

        for (const kab of kabupatenList) {
          const code = String(kab.id || '').trim();
          if (!code) continue;
          const name = formatBranchName(kab.nama);
          const city = extractCity(kab.nama);
          branches.push({
            id: crypto.randomUUID(),
            code,
            name,
            city: city || name,
            region,
            manager_name: null,
            phone: null,
            email: null,
            address: null,
            is_active: true,
            created_at: now,
            updated_at: now
          });
        }
      }

      if (branches.length === 0) {
        console.warn('[seed branches-indonesia] Tidak ada data kabupaten/kota.');
        return;
      }

      // Skip code yang sudah ada (untuk re-run atau demo JKT/SBY/BDG)
      const codes = branches.map(b => b.code);
      const chunks = [];
      for (let i = 0; i < codes.length; i += 100) {
        chunks.push(codes.slice(i, i + 100));
      }
      const existingCodes = new Set();
      for (const chunk of chunks) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT code FROM branches WHERE code IN (${chunk.map(c => `'${String(c).replace(/'/g, "''")}'`).join(',')})`
        ).catch(() => [[]]);
        (rows || []).forEach(r => existingCodes.add(r.code));
      }
      const toInsert = branches.filter(b => !existingCodes.has(b.code));

      if (toInsert.length > 0) {
        await queryInterface.bulkInsert('branches', toInsert);
        console.log(`[seed branches-indonesia] Berhasil menambah ${toInsert.length} cabang (kabupaten/kota).`);
      } else {
        console.log('[seed branches-indonesia] Semua data sudah ada, tidak ada yang ditambah.');
      }
    } catch (err) {
      console.error('[seed branches-indonesia] Error:', err.message);
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    // Hapus hanya cabang dengan code numerik (kode BPS), jangan hapus JKT, SBY, BDG
    await queryInterface.sequelize.query(
      `DELETE FROM branches WHERE code ~ '^[0-9]+$'`
    );
    console.log('[seed branches-indonesia] Cabang kabupaten/kota telah dihapus.');
  }
};
