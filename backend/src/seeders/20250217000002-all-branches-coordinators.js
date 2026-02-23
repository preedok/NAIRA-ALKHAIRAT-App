'use strict';

/**
 * Mengisi koordinator_provinsi dan koordinator_wilayah untuk SEMUA cabang (kabupaten/kota) di database.
 * Satu koordinator provinsi per provinsi, satu koordinator wilayah per kabupaten (menggunakan nama kabupaten).
 * Owner yang mendaftar pilih kabupaten -> sistem auto-detect provinsi & koordinator.
 */
const PROVINCE_COORDINATORS = {
  'ACEH': { name: 'Ahmad Fauzi', phone: '+62 812 3000 001', email: 'koord.aceh@bintangglobal.com' },
  'NANGROE ACEH DARUSSALAM': { name: 'Ahmad Fauzi', phone: '+62 812 3000 001', email: 'koord.aceh@bintangglobal.com' },
  'SUMATERA UTARA': { name: 'Siti Aminah', phone: '+62 812 3000 002', email: 'koord.sumut@bintangglobal.com' },
  'SUMATERA BARAT': { name: 'Budi Hartono', phone: '+62 812 3000 003', email: 'koord.sumbar@bintangglobal.com' },
  'RIAU': { name: 'Dewi Lestari', phone: '+62 812 3000 004', email: 'koord.riau@bintangglobal.com' },
  'KEPULAUAN RIAU': { name: 'Hendra Wijaya', phone: '+62 812 3000 005', email: 'koord.kepri@bintangglobal.com' },
  'JAMBI': { name: 'Rina Melati', phone: '+62 812 3000 006', email: 'koord.jambi@bintangglobal.com' },
  'BENGKULU': { name: 'Bambang Prasetyo', phone: '+62 812 3000 007', email: 'koord.bengkulu@bintangglobal.com' },
  'SUMATERA SELATAN': { name: 'Ani Lestari', phone: '+62 812 3000 008', email: 'koord.sumsel@bintangglobal.com' },
  'KEPULAUAN BANGKA BELITUNG': { name: 'Fajar Nugroho', phone: '+62 812 3000 009', email: 'koord.babel@bintangglobal.com' },
  'LAMPUNG': { name: 'Kartika Sari', phone: '+62 812 3000 010', email: 'koord.lampung@bintangglobal.com' },
  'BANTEN': { name: 'Rizki Ahmad', phone: '+62 812 3000 011', email: 'koord.banten@bintangglobal.com' },
  'DKI JAKARTA': { name: 'Budi Santoso', phone: '+62 812 3456 7890', email: 'budi.santoso@bintangglobal.com' },
  'JAWA BARAT': { name: 'Ani Lestari', phone: '+62 823 5555 6666', email: 'ani.lestari@bintangglobal.com' },
  'JAWA TENGAH': { name: 'Dewi Kartika', phone: '+62 812 3000 014', email: 'koord.jateng@bintangglobal.com' },
  'DI YOGYAKARTA': { name: 'Eko Prasetyo', phone: '+62 812 3000 015', email: 'koord.diy@bintangglobal.com' },
  'DAERAH ISTIMEWA YOGYAKARTA': { name: 'Eko Prasetyo', phone: '+62 812 3000 015', email: 'koord.diy@bintangglobal.com' },
  'JAWA TIMUR': { name: 'Hendra Wijaya', phone: '+62 821 1111 2222', email: 'hendra.wijaya@bintangglobal.com' },
  'BALI': { name: 'Made Sudarma', phone: '+62 812 3000 018', email: 'koord.bali@bintangglobal.com' },
  'NUSA TENGGARA BARAT': { name: 'Lalu Ahmad', phone: '+62 812 3000 019', email: 'koord.ntb@bintangglobal.com' },
  'NUSA TENGGARA TIMUR': { name: 'Maria Fernandez', phone: '+62 812 3000 020', email: 'koord.ntt@bintangglobal.com' },
  'KALIMANTAN BARAT': { name: 'Surya Dharma', phone: '+62 812 3000 021', email: 'koord.kalbar@bintangglobal.com' },
  'KALIMANTAN TENGAH': { name: 'Bambang S', phone: '+62 812 3000 022', email: 'koord.kalteng@bintangglobal.com' },
  'KALIMANTAN SELATAN': { name: 'Rahmat Hidayat', phone: '+62 812 3000 023', email: 'koord.kalsel@bintangglobal.com' },
  'KALIMANTAN TIMUR': { name: 'Andi Rahman', phone: '+62 812 3000 024', email: 'koord.kaltim@bintangglobal.com' },
  'KALIMANTAN UTARA': { name: 'Faisal Ibrahim', phone: '+62 812 3000 025', email: 'koord.kalut@bintangglobal.com' },
  'SULAWESI UTARA': { name: 'Jefri Tambunan', phone: '+62 812 3000 026', email: 'koord.sulut@bintangglobal.com' },
  'SULAWESI TENGAH': { name: 'Rusli M', phone: '+62 812 3000 027', email: 'koord.sulteng@bintangglobal.com' },
  'SULAWESI SELATAN': { name: 'Andi Baso', phone: '+62 812 3000 028', email: 'koord.sulsel@bintangglobal.com' },
  'SULAWESI BARAT': { name: 'Muhammad Arif', phone: '+62 812 3000 029', email: 'koord.sulbar@bintangglobal.com' },
  'SULAWESI TENGGARA': { name: 'La Ode Ahmad', phone: '+62 812 3000 030', email: 'koord.sultra@bintangglobal.com' },
  'GORONTALO': { name: 'Rahmat Ilham', phone: '+62 812 3000 031', email: 'koord.gorontalo@bintangglobal.com' },
  'MALUKU': { name: 'Abdul Rahman', phone: '+62 812 3000 032', email: 'koord.maluku@bintangglobal.com' },
  'MALUKU UTARA': { name: 'Hasan Basri', phone: '+62 812 3000 033', email: 'koord.malut@bintangglobal.com' },
  'PAPUA': { name: 'Yohanis Wenda', phone: '+62 812 3000 034', email: 'koord.papua@bintangglobal.com' },
  'PAPUA BARAT': { name: 'Stefanus Rumbewas', phone: '+62 812 3000 035', email: 'koord.papbar@bintangglobal.com' },
  'PAPUA SELATAN': { name: 'Marthen Wanimbo', phone: '+62 812 3000 036', email: 'koord.papua-selatan@bintangglobal.com' },
  'PAPUA TENGAH': { name: 'Yulianus Pigai', phone: '+62 812 3000 037', email: 'koord.papua-tengah@bintangglobal.com' },
  'PAPUA PEGUNUNGAN': { name: 'Elianus Kogoya', phone: '+62 812 3000 038', email: 'koord.papua-pegunungan@bintangglobal.com' },
  'PAPUA BARAT DAYA': { name: 'Samuel Kareth', phone: '+62 812 3000 039', email: 'koord.papua-barat-daya@bintangglobal.com' },
  'BANGKA BELITUNG': { name: 'Fajar Nugroho', phone: '+62 812 3000 009', email: 'koord.babel@bintangglobal.com' },
  'KEP. BANGKA BELITUNG': { name: 'Fajar Nugroho', phone: '+62 812 3000 009', email: 'koord.babel@bintangglobal.com' },
  'KEP. RIAU': { name: 'Hendra Wijaya', phone: '+62 812 3000 005', email: 'koord.kepri@bintangglobal.com' },
  'YOGYAKARTA': { name: 'Eko Prasetyo', phone: '+62 812 3000 015', email: 'koord.diy@bintangglobal.com' },
  'NTB': { name: 'Lalu Ahmad', phone: '+62 812 3000 019', email: 'koord.ntb@bintangglobal.com' },
  'NTT': { name: 'Maria Fernandez', phone: '+62 812 3000 020', email: 'koord.ntt@bintangglobal.com' }
};

function normalizeRegion(region) {
  if (!region || typeof region !== 'string') return '';
  return region.trim().toUpperCase();
}

function getCoordinatorForRegion(region) {
  const key = normalizeRegion(region);
  if (PROVINCE_COORDINATORS[key]) return PROVINCE_COORDINATORS[key];
  for (const [prov, coord] of Object.entries(PROVINCE_COORDINATORS)) {
    if (key.includes(prov) || prov.includes(key)) return coord;
  }
  return { name: `Koord. ${region || 'Umum'}`, phone: '+62 812 0000 000', email: 'koord@bintangglobal.com' };
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const [branches] = await q.query(
      `SELECT id, code, name, city, region FROM branches`
    );
    if (!branches || branches.length === 0) {
      console.log('[seed all-branches-coordinators] Tidak ada cabang.');
      return;
    }

    const skipCodes = new Set(['JKT', 'SBY', 'BDG']);
    let updated = 0;
    for (const b of branches) {
      if (skipCodes.has(b.code)) continue;
      const coord = getCoordinatorForRegion(b.region);
      const koordWilayah = `Koord. ${(b.name || b.city || '').replace(/'/g, "''")}`;
      await q.query(`
        UPDATE branches SET
          koordinator_provinsi = '${String(coord.name || '').replace(/'/g, "''")}',
          koordinator_provinsi_phone = '${String(coord.phone || '').replace(/'/g, "''")}',
          koordinator_provinsi_email = '${String(coord.email || '').replace(/'/g, "''")}',
          koordinator_wilayah = '${koordWilayah}',
          koordinator_wilayah_phone = '${String(coord.phone || '').replace(/'/g, "''")}',
          koordinator_wilayah_email = '${String(coord.email || '').replace(/'/g, "''")}',
          updated_at = NOW()
        WHERE id = '${b.id}'
      `).catch(() => {});
      updated++;
    }
    console.log(`[seed all-branches-coordinators] ${updated} cabang telah diisi koordinator provinsi & wilayah.`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE branches SET
        koordinator_provinsi = NULL,
        koordinator_provinsi_phone = NULL,
        koordinator_provinsi_email = NULL,
        koordinator_wilayah = NULL,
        koordinator_wilayah_phone = NULL,
        koordinator_wilayah_email = NULL,
        updated_at = NOW()
      WHERE code ~ '^[0-9]+$'
    `).catch(() => {});
    console.log('[seed all-branches-coordinators] Koordinator kabupaten numerik telah dihapus.');
  }
};
