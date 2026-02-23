/**
 * Fetch data from Indonesia BPS/Kemendagri API
 * Sumber: https://ibnux.github.io/data-indonesia/
 */
const https = require('https');

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

async function getProvinces() {
  const data = await fetchJson(`${BASE_URL}/provinsi.json`);
  return Array.isArray(data) ? data : [];
}

async function getKabupatenByProvince(provinceId) {
  const data = await fetchJson(`${BASE_URL}/kabupaten/${provinceId}.json`);
  return Array.isArray(data) ? data : [];
}

module.exports = {
  fetchJson,
  getProvinces,
  getKabupatenByProvince,
  formatBranchName,
  extractCity,
  BASE_URL
};
