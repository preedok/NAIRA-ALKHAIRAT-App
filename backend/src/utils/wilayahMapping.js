/**
 * Wilayah = region utama di atas provinsi (Sumatra, Jawa, Kalimantan, dll)
 * Provinsi otomatis masuk ke wilayah berdasarkan mapping ini
 */
const WILAYAH_MAJOR = [
  'Sumatra',
  'Jawa',
  'Kalimantan',
  'Sulawesi',
  'Bali-Nusa Tenggara',
  'Maluku',
  'Papua',
  'Lainnya'
];

const PROVINSI_TO_WILAYAH = {
  'ACEH': 'Sumatra',
  'NANGROE ACEH DARUSSALAM': 'Sumatra',
  'SUMATERA UTARA': 'Sumatra',
  'SUMATERA BARAT': 'Sumatra',
  'RIAU': 'Sumatra',
  'KEPULAUAN RIAU': 'Sumatra',
  'KEP. RIAU': 'Sumatra',
  'JAMBI': 'Sumatra',
  'SUMATERA SELATAN': 'Sumatra',
  'KEPULAUAN BANGKA BELITUNG': 'Sumatra',
  'BANGKA BELITUNG': 'Sumatra',
  'KEP. BANGKA BELITUNG': 'Sumatra',
  'BENGKULU': 'Sumatra',
  'LAMPUNG': 'Sumatra',
  'BANTEN': 'Jawa',
  'DKI JAKARTA': 'Jawa',
  'JAWA BARAT': 'Jawa',
  'JAWA TENGAH': 'Jawa',
  'DI YOGYAKARTA': 'Jawa',
  'DAERAH ISTIMEWA YOGYAKARTA': 'Jawa',
  'YOGYAKARTA': 'Jawa',
  'JAWA TIMUR': 'Jawa',
  'BALI': 'Bali-Nusa Tenggara',
  'NUSA TENGGARA BARAT': 'Bali-Nusa Tenggara',
  'NUSA TENGGARA TIMUR': 'Bali-Nusa Tenggara',
  'NTB': 'Bali-Nusa Tenggara',
  'NTT': 'Bali-Nusa Tenggara',
  'KALIMANTAN BARAT': 'Kalimantan',
  'KALIMANTAN TENGAH': 'Kalimantan',
  'KALIMANTAN SELATAN': 'Kalimantan',
  'KALIMANTAN TIMUR': 'Kalimantan',
  'KALIMANTAN UTARA': 'Kalimantan',
  'SULAWESI UTARA': 'Sulawesi',
  'SULAWESI TENGAH': 'Sulawesi',
  'SULAWESI SELATAN': 'Sulawesi',
  'SULAWESI BARAT': 'Sulawesi',
  'SULAWESI TENGGARA': 'Sulawesi',
  'GORONTALO': 'Sulawesi',
  'MALUKU': 'Maluku',
  'MALUKU UTARA': 'Maluku',
  'PAPUA': 'Papua',
  'PAPUA BARAT': 'Papua',
  'PAPUA SELATAN': 'Papua',
  'PAPUA TENGAH': 'Papua',
  'PAPUA PEGUNUNGAN': 'Papua',
  'PAPUA BARAT DAYA': 'Papua'
};

function normalizeKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toUpperCase();
}

function getWilayahFromProvinsi(provinsiName) {
  const key = normalizeKey(provinsiName);
  if (PROVINSI_TO_WILAYAH[key]) return PROVINSI_TO_WILAYAH[key];
  for (const [prov, wilayah] of Object.entries(PROVINSI_TO_WILAYAH)) {
    if (key.includes(prov) || prov.includes(key)) return wilayah;
  }
  return 'Lainnya';
}

module.exports = {
  WILAYAH_MAJOR,
  PROVINSI_TO_WILAYAH,
  getWilayahFromProvinsi
};
