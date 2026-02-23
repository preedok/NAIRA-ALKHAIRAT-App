/**
 * Hapus database lama (bintang_global), buat database baru (db_bgg_group) kosong.
 * Koneksi memakai DB_* dari .env; koneksi ke database 'postgres' (bukan ke DB target).
 * Setelah script ini, jalankan: npm run db:update (migrate + sync + seed).
 *
 * Usage: node scripts/recreate-database.js (dari folder backend)
 */
require('dotenv').config();
const { Client } = require('pg');

const OLD_DB = 'bintang_global';
const NEW_DB = 'db_bgg_group'; // selalu pakai nama ini saat recreate; set DB_NAME=db_bgg_group di .env

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Terhubung ke PostgreSQL (database: postgres).');

    // Putuskan koneksi ke DB lama lalu drop
    await client.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [OLD_DB]);
    await client.query('DROP DATABASE IF EXISTS "' + OLD_DB.replace(/"/g, '""') + '"');
    console.log('Database "' + OLD_DB + '" dihapus (jika ada).');

    // Putuskan koneksi ke DB baru (kalau ada) lalu drop dan buat ulang
    await client.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [NEW_DB]);
    await client.query('DROP DATABASE IF EXISTS "' + NEW_DB.replace(/"/g, '""') + '"');
    await client.query('CREATE DATABASE "' + NEW_DB.replace(/"/g, '""') + '"');
    console.log(`Database "${NEW_DB}" dibuat (kosong).`);
    console.log('Pastikan backend/.env berisi DB_NAME=db_bgg_group. Lalu db:update akan dijalankan.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
