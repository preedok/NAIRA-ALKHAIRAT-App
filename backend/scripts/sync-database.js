/**
 * Membuat/update tabel di PostgreSQL tanpa menjalankan server HTTP.
 * Jalankan sebelum seed agar semua tabel ada.
 * Usage: node scripts/sync-database.js (dari folder backend)
 */
require('dotenv').config();
const path = require('path');

// Load config dan sequelize dari backend
const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
require(path.join(__dirname, '../src/models'));

async function ensureUsersPasswordHashColumn(db) {
  try {
    const [rows] = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('password_hash', 'passwordhash', 'password');
    `);
    const columns = (rows || []).map(r => r.column_name);
    if (columns.includes('password_hash')) return;
    if (columns.includes('passwordhash')) {
      await db.query('ALTER TABLE users RENAME COLUMN passwordhash TO password_hash');
      console.log('users: renamed column passwordhash -> password_hash');
      return;
    }
    if (columns.includes('password')) {
      await db.query('ALTER TABLE users RENAME COLUMN password TO password_hash');
      console.log('users: renamed column password -> password_hash');
      return;
    }
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    console.log('users: added column password_hash');
  } catch (e) {
    console.warn('ensureUsersPasswordHashColumn:', e.message);
  }
}

async function main() {
  try {
    const useAlter = process.env.SYNC_ALTER === 'true' || process.env.NODE_ENV === 'development';
    if (useAlter) console.log('Mode: alter=true (perubahan kolom dari model akan diterapkan)');
    console.log('Syncing database (creating/updating tables)...');
    await sequelize.sync({ alter: useAlter });
    await ensureUsersPasswordHashColumn(sequelize);
    console.log('Database sync selesai. Tabel siap untuk seed.');
    process.exit(0);
  } catch (err) {
    console.error('Sync gagal:', err.message);
    process.exit(1);
  }
}

main();
