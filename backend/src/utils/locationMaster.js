/**
 * Master lokasi: Wilayah → Provinsi → Kabupaten (Kota)
 * Digunakan modul-modul untuk generate otomatis:
 * - Jika kota (kode kabupaten) ada → isi provinsi_id, wilayah_id, dan nama masing-masing
 * - Jika provinsi ada → isi wilayah_id dan nama wilayah
 * - Jika wilayah ada → bisa ambil daftar provinsi/kota
 * Relasi di DB: wilayah hasMany provinsi, provinsi hasMany kabupaten; Branch.code = kabupaten.kode, Branch.provinsi_id → provinsi
 */

const { Wilayah, Provinsi, Kabupaten, Branch, User } = require('../models');
const { Op } = require('sequelize');

/** Mapping provinsi (kode/nama) ke nama wilayah untuk sync provinsi.wilayah_id */
const PROVINSI_KE_WILAYAH = [
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

function _norm(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Resolve lokasi lengkap dari kode atau id Kabupaten (Kota).
 * Untuk generate otomatis provinsi & wilayah ketika data kota ada.
 * @param {string} kodeOrId - Kode kabupaten (e.g. '3201') atau UUID id kabupaten
 * @returns {Promise<{ kabupaten: { id, kode, nama }, provinsi: { id, kode, name, wilayah_id }, wilayah: { id, name } } | null>}
 */
async function resolveFromKota(kodeOrId) {
  if (!kodeOrId || String(kodeOrId).trim() === '') return null;
  const str = String(kodeOrId).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const where = isUuid ? { id: str } : { kode: str };
  const kabupaten = await Kabupaten.findOne({
    where,
    include: [
      {
        model: Provinsi,
        as: 'Provinsi',
        attributes: ['id', 'kode', 'name', 'wilayah_id'],
        required: true,
        include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }]
      }
    ]
  });
  if (!kabupaten || !kabupaten.Provinsi) return null;
  const provinsi = kabupaten.Provinsi;
  const wilayah = provinsi.Wilayah || null;
  return {
    kabupaten: { id: kabupaten.id, kode: kabupaten.kode, nama: kabupaten.nama },
    provinsi: { id: provinsi.id, kode: provinsi.kode, name: provinsi.name, wilayah_id: provinsi.wilayah_id },
    wilayah: wilayah ? { id: wilayah.id, name: wilayah.name } : null
  };
}

/**
 * Resolve provinsi dan wilayah dari id provinsi.
 * Untuk generate otomatis wilayah ketika provinsi ada.
 * @param {string} provinsiId - UUID provinsi
 * @returns {Promise<{ provinsi: { id, kode, name, wilayah_id }, wilayah: { id, name } | null } | null>}
 */
async function resolveFromProvinsi(provinsiId) {
  if (!provinsiId || String(provinsiId).trim() === '') return null;
  const provinsi = await Provinsi.findByPk(provinsiId, {
    attributes: ['id', 'kode', 'name', 'wilayah_id'],
    include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }]
  });
  if (!provinsi) return null;
  return {
    provinsi: { id: provinsi.id, kode: provinsi.kode, name: provinsi.name, wilayah_id: provinsi.wilayah_id },
    wilayah: provinsi.Wilayah ? { id: provinsi.Wilayah.id, name: provinsi.Wilayah.name } : null
  };
}

/**
 * Resolve wilayah dari id wilayah (dan optional daftar provinsi/kabupaten).
 * @param {string} wilayahId - UUID wilayah
 * @param {boolean} withProvinsi - Jika true, include daftar provinsi di wilayah ini
 * @returns {Promise<{ wilayah: { id, name }, provinsi?: Array } | null>}
 */
async function resolveFromWilayah(wilayahId, withProvinsi = false) {
  if (!wilayahId || String(wilayahId).trim() === '') return null;
  const opts = { attributes: ['id', 'name'] };
  if (withProvinsi) {
    opts.include = [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'kode', 'name'], required: false }];
  }
  const wilayah = await Wilayah.findByPk(wilayahId, opts);
  if (!wilayah) return null;
  const result = { wilayah: { id: wilayah.id, name: wilayah.name } };
  if (withProvinsi && wilayah.Provinsi) result.provinsi = wilayah.Provinsi;
  return result;
}

/**
 * Isi objek lokasi untuk response/entity ketika hanya punya kode kota (atau branch.code).
 * Mengisi provinsi_id, provinsi_name, wilayah_id, wilayah_name dari master kabupaten.
 * @param {string} kodeKota - Kode kabupaten (Branch.code)
 * @returns {Promise<{ provinsi_id: string, provinsi_name: string, wilayah_id: string, wilayah_name: string } | null>}
 */
async function fillLocationFromKotaCode(kodeKota) {
  const resolved = await resolveFromKota(kodeKota);
  if (!resolved) return null;
  return {
    provinsi_id: resolved.provinsi.id,
    provinsi_name: resolved.provinsi.name,
    wilayah_id: resolved.wilayah ? resolved.wilayah.id : null,
    wilayah_name: resolved.wilayah ? resolved.wilayah.name : null
  };
}

/**
 * Sinkronisasi Branch: isi provinsi_id dari Branch.code (kode kabupaten) jika provinsi_id masih null.
 * Dipanggil oleh script sync atau saat simpan branch.
 * @param {Object} branch - Instance Branch atau { id, code }
 * @returns {Promise<boolean>} true jika berhasil update
 */
async function syncBranchProvinsiFromKode(branch) {
  const code = branch && (branch.code || (typeof branch.get === 'function' ? branch.get('code') : null));
  if (!code || String(code).trim() === '') return false;
  const resolved = await resolveFromKota(String(code).trim());
  if (!resolved || !resolved.provinsi) return false;
  const id = branch.id || (typeof branch.get === 'function' ? branch.get('id') : null);
  if (!id) return false;
  await Branch.update(
    { provinsi_id: resolved.provinsi.id },
    { where: { id } }
  );
  return true;
}

/**
 * Sinkronisasi semua Branch yang provinsi_id-nya null tapi code-nya terisi.
 * Berguna untuk backfill setelah master kabupaten terisi.
 */
async function syncAllBranchesProvinsiFromMaster() {
  const branches = await Branch.findAll({
    where: { [Op.and]: [{ provinsi_id: { [Op.is]: null } }, { code: { [Op.ne]: null }, code: { [Op.ne]: '' } }] },
    attributes: ['id', 'code']
  });
  let updated = 0;
  for (const b of branches) {
    const ok = await syncBranchProvinsiFromKode(b);
    if (ok) updated += 1;
  }
  return { total: branches.length, updated };
}

/**
 * Sinkronisasi Provinsi: isi wilayah_id yang null sesuai mapping nama/kode provinsi ke wilayah.
 * Dipanggil dari script sync atau migration.
 * @param {Object} wilayahByName - Map nama wilayah -> id (dari Wilayah.findAll)
 * @returns {Promise<number>} jumlah provinsi yang di-update
 */
async function syncProvinsiWilayah(wilayahByName) {
  const provinsiNull = await Provinsi.findAll({
    where: { wilayah_id: null },
    attributes: ['id', 'kode', 'name']
  });
  if (provinsiNull.length === 0) return 0;
  const byKode = {};
  const byName = {};
  PROVINSI_KE_WILAYAH.forEach((p) => {
    byKode[p.kode] = p.wilayah;
    byName[_norm(p.nama)] = p.wilayah;
  });
  let updated = 0;
  for (const p of provinsiNull) {
    const wilayahName = byKode[p.kode] || byName[_norm(p.name)] || 'Lainnya';
    const wilayahId = wilayahByName[wilayahName];
    if (wilayahId) {
      await p.update({ wilayah_id: wilayahId });
      updated += 1;
    }
  }
  return updated;
}

/**
 * Sinkronisasi Branch: isi provinsi_id dari nama kota (Branch.city ≈ Kabupaten.nama) untuk cabang yang provinsi_id masih null.
 * @param {Object} kabupatenByNama - Map nama kabupaten (normalized) -> { provinsi_id }
 * @returns {Promise<number>} jumlah cabang yang di-update
 */
async function syncBranchProvinsiFromCity(kabupatenByNama) {
  const branches = await Branch.findAll({
    where: { provinsi_id: null },
    attributes: ['id', 'code', 'city', 'name']
  });
  let updated = 0;
  for (const b of branches) {
    const city = (b.city || b.name || '').trim();
    if (!city) continue;
    const key = _norm(city);
    const kab = kabupatenByNama[key];
    if (kab && kab.provinsi_id) {
      await b.update({ provinsi_id: kab.provinsi_id });
      updated += 1;
    }
  }
  return updated;
}

/** Alias region → nama provinsi (match ke tabel provinsi) */
const REGION_TO_PROVINSI_ALIAS = {
  'NANGROE ACEH DARUSSALAM': 'ACEH',
  'KEP. BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
  'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
  'KEP. RIAU': 'KEPULAUAN RIAU',
  'DI YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
  'YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
  'NTB': 'NUSA TENGGARA BARAT',
  'NTT': 'NUSA TENGGARA TIMUR'
};

/**
 * Sinkronisasi Branch: isi provinsi_id dari Branch.region (string) dengan match ke nama provinsi.
 * Untuk cabang yang provinsi_id masih null tapi region terisi.
 * @param {Object} provinsiByNormName - Map nama provinsi (normalized) -> id
 * @returns {Promise<number>} jumlah cabang yang di-update
 */
async function syncBranchProvinsiFromRegion(provinsiByNormName) {
  const branches = await Branch.findAll({
    where: { provinsi_id: null },
    attributes: ['id', 'region']
  });
  let updated = 0;
  for (const b of branches) {
    const region = (b.region || '').trim();
    if (!region) continue;
    let key = _norm(region);
    if (REGION_TO_PROVINSI_ALIAS[key]) key = _norm(REGION_TO_PROVINSI_ALIAS[key]);
    const provinsiId = provinsiByNormName[key];
    if (provinsiId) {
      await b.update({ provinsi_id: provinsiId });
      updated += 1;
    }
  }
  return updated;
}

/**
 * Set wilayah_id satu user dari branch-nya (Branch → Provinsi → Wilayah).
 * Dipanggil setelah User.branch_id di-set (assign-branch, activate, create user dengan branch).
 * @param {string} userId - UUID user
 * @param {string} branchId - UUID branch
 * @returns {Promise<boolean>} true jika user di-update
 */
async function setUserWilayahFromBranch(userId, branchId) {
  if (!userId || !branchId) return false;
  const branch = await Branch.findByPk(branchId, {
    attributes: ['id'],
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }]
  });
  const wilayahId = branch && branch.Provinsi ? branch.Provinsi.wilayah_id : null;
  if (!wilayahId) return false;
  await User.update({ wilayah_id: wilayahId }, { where: { id: userId } });
  return true;
}

/**
 * Sinkronisasi User: isi wilayah_id dari Branch → Provinsi → Wilayah untuk user yang branch_id terisi tapi wilayah_id null.
 * Untuk koordinator/owner agar scope wilayah otomatis sesuai cabang.
 * @returns {Promise<number>} jumlah user yang di-update
 */
async function syncUserWilayahFromBranch() {
  const users = await User.findAll({
    where: { branch_id: { [Op.ne]: null }, wilayah_id: null },
    attributes: ['id', 'branch_id']
  });
  if (users.length === 0) return 0;
  const branchIds = [...new Set(users.map((u) => u.branch_id).filter(Boolean))];
  const branches = await Branch.findAll({
    where: { id: { [Op.in]: branchIds } },
    attributes: ['id', 'provinsi_id'],
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }]
  });
  const branchToWilayah = {};
  branches.forEach((b) => {
    const wid = b.Provinsi && b.Provinsi.wilayah_id ? b.Provinsi.wilayah_id : null;
    if (wid) branchToWilayah[b.id] = wid;
  });
  let updated = 0;
  for (const u of users) {
    const wilayahId = branchToWilayah[u.branch_id];
    if (wilayahId) {
      await User.update({ wilayah_id: wilayahId }, { where: { id: u.id } });
      updated += 1;
    }
  }
  return updated;
}

/**
 * Jalankan full sync: provinsi.wilayah_id + branch.provinsi_id + user.wilayah_id (dari kode, kota, region, dan branch).
 * Dipakai oleh script sync, migration, dan deploy. Idempotent.
 * @returns {Promise<{ provinsiUpdated: number, branchByCode: number, branchByCity: number, branchByRegion: number, userWilayahUpdated: number }>}
 */
async function runFullSync() {
  const wilayahList = await Wilayah.findAll({ attributes: ['id', 'name'] });
  const wilayahByName = {};
  wilayahList.forEach((w) => { wilayahByName[w.name] = w.id; });

  const provinsiUpdated = await syncProvinsiWilayah(wilayahByName);

  const provinsiList = await Provinsi.findAll({ attributes: ['id', 'name'] });
  const provinsiByNormName = {};
  provinsiList.forEach((p) => {
    const key = _norm(p.name);
    if (key) provinsiByNormName[key] = p.id;
  });

  const kabupatenList = await Kabupaten.findAll({ attributes: ['kode', 'nama', 'provinsi_id'] });
  const kabupatenByNama = {};
  kabupatenList.forEach((k) => {
    if (k.nama) kabupatenByNama[_norm(k.nama)] = k;
  });

  const { updated: branchByCode } = await syncAllBranchesProvinsiFromMaster();
  const branchByCity = await syncBranchProvinsiFromCity(kabupatenByNama);
  const branchByRegion = await syncBranchProvinsiFromRegion(provinsiByNormName);
  const userWilayahUpdated = await syncUserWilayahFromBranch();

  return { provinsiUpdated, branchByCode, branchByCity, branchByRegion, userWilayahUpdated };
}

/**
 * Enrich branch (plain object atau model) dengan provinsi_id, provinsi_name, wilayah_id, wilayah_name.
 * Jika sudah ada dari Branch.Provinsi / Branch.Provinsi.Wilayah pakai itu; jika null dan branch.code ada, isi dari master (kota).
 * Dipakai semua modul yang return Branch agar lokasi selalu tampil.
 * @param {Object} branch - { id, code, provinsi_id?, Provinsi?: { name, Wilayah?: { name } } }
 * @param {Object} [opts] - { syncDb: boolean } jika true dan provinsi_id null, panggil syncBranchProvinsiFromKode
 * @returns {Promise<{ provinsi_id?: string, provinsi_name?: string, wilayah_id?: string, wilayah_name?: string }>}
 */
async function enrichBranchWithLocation(branch, opts = {}) {
  if (!branch) return {};
  const get = (key) => (typeof branch.get === 'function' ? branch.get(key) : branch[key]);
  const code = get('code');
  const provinsiId = get('provinsi_id');
  const provinsi = branch.Provinsi || get('Provinsi');
  const wilayah = provinsi && (provinsi.Wilayah || provinsi.wilayah);
  let provinsi_name = provinsi ? (provinsi.name || provinsi.nama) : null;
  let wilayah_name = wilayah ? (wilayah.name || wilayah.nama) : null;
  let wilayah_id = wilayah ? (wilayah.id || null) : null;
  let resolved_provinsi_id = provinsiId || (provinsi ? (provinsi.id || null) : null);
  if ((!provinsi_name || !wilayah_name || !resolved_provinsi_id) && code) {
    const filled = await fillLocationFromKotaCode(String(code).trim());
    if (filled) {
      if (!provinsi_name) provinsi_name = filled.provinsi_name;
      if (!wilayah_name) wilayah_name = filled.wilayah_name;
      if (!resolved_provinsi_id) resolved_provinsi_id = filled.provinsi_id;
      if (!wilayah_id) wilayah_id = filled.wilayah_id;
      if (opts.syncDb && get('id') && !provinsiId) {
        await syncBranchProvinsiFromKode({ id: get('id'), code });
      }
    }
  }
  return {
    provinsi_id: resolved_provinsi_id || null,
    provinsi_name: provinsi_name || null,
    wilayah_id: wilayah_id || null,
    wilayah_name: wilayah_name || null
  };
}

/**
 * Enrich objek (invoice/order) yang punya Branch: tambah provinsi_name, wilayah_name pada Branch.
 * @param {Object} item - Object yang punya .Branch (e.g. invoice, order)
 * @param {Object} [opts] - { syncDb: boolean }
 */
async function enrichItemBranchLocation(item, opts = {}) {
  if (!item || !item.Branch) return;
  const loc = await enrichBranchWithLocation(item.Branch, opts);
  const b = item.Branch;
  const data = typeof b.toJSON === 'function' ? b.toJSON() : b;
  if (loc.provinsi_name != null) data.provinsi_name = loc.provinsi_name;
  if (loc.wilayah_name != null) data.wilayah_name = loc.wilayah_name;
  if (loc.provinsi_id != null) data.provinsi_id = loc.provinsi_id;
  if (loc.wilayah_id != null) data.wilayah_id = loc.wilayah_id;
  item.Branch = data;
}

module.exports = {
  resolveFromKota,
  resolveFromProvinsi,
  resolveFromWilayah,
  fillLocationFromKotaCode,
  syncBranchProvinsiFromKode,
  syncAllBranchesProvinsiFromMaster,
  syncProvinsiWilayah,
  syncBranchProvinsiFromCity,
  syncBranchProvinsiFromRegion,
  setUserWilayahFromBranch,
  syncUserWilayahFromBranch,
  runFullSync,
  enrichBranchWithLocation,
  enrichItemBranchLocation
};
