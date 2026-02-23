/**
 * Kosongkan isi folder uploads (hapus semua file di tiap subdir).
 * Dipakai saat reset data untuk trial testing: DB dikosongkan (kecuali user), upload juga bersih.
 *
 * Usage: node scripts/clean-uploads.js (dari folder backend)
 * Atau: npm run clean:uploads
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { UPLOAD_ROOT, SUBDIRS } = require('../src/config/uploads');

function rmDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      rmDirRecursive(full);
      fs.rmdirSync(full);
    } else {
      fs.unlinkSync(full);
    }
  }
}

function cleanSubdir(subdir) {
  const full = path.join(UPLOAD_ROOT, subdir);
  if (fs.existsSync(full)) {
    rmDirRecursive(full);
    console.log('  ✓ ' + subdir);
  }
}

function main() {
  console.log('Membersihkan isi folder uploads:', UPLOAD_ROOT);
  if (!fs.existsSync(UPLOAD_ROOT)) {
    console.log('  Folder uploads belum ada, skip.');
    process.exit(0);
    return;
  }
  Object.values(SUBDIRS).forEach(cleanSubdir);
  // Hapus juga file langsung di root uploads (kalau ada)
  const rootEntries = fs.readdirSync(UPLOAD_ROOT, { withFileTypes: true });
  for (const ent of rootEntries) {
    if (ent.isFile()) {
      fs.unlinkSync(path.join(UPLOAD_ROOT, ent.name));
      console.log('  ✓ (root) ' + ent.name);
    }
  }
  console.log('Selesai. Upload kosong, siap trial testing.');
  process.exit(0);
}

main();
