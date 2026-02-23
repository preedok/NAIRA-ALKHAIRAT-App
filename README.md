# Bintang Global Group - Enterprise B2B Platform

Platform manajemen terintegrasi untuk layanan umroh: hotel, visa, tiket, bus, paket, invoice, dan multi-role (Admin Pusat, Admin Cabang, Role Invoice, Hotel, Visa, Tiket, Bus, Accounting, Owner).

## Quick Start

```bash
# 1. Install dependencies (root + backend + frontend)
npm run install:all

# 2. PostgreSQL: buat database (nama: db_bgg_group)
# Pakai user yang sama dengan backend/.env (biasanya postgres):
createdb -U postgres db_bgg_group
# Masukkan password user postgres saat diminta (sama dengan DB_PASSWORD di .env).

# 3. Environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Isi backend/.env: DB_NAME=db_bgg_group, DB_USERNAME, DB_PASSWORD, dll.
# Frontend .env: REACT_APP_API_URL=http://localhost:5000/api/v1

# 4. Update database (migrate + buat tabel + seed) — wajib setelah DB kosong
npm run db:update
# Atau double-click: run-db-update.bat
# Ini akan: migrate → sync (buat semua tabel) → seed (isi cabang, akun semua role, 3 owner, produk, order contoh)

# 5. Jalankan aplikasi (backend + frontend sekaligus)
npm start
# Atau double-click: run-project.bat (bebaskan port 5000/3000 dulu lalu start)
```

- **Database:** Nama database: **db_bgg_group**. Jalankan `npm run db:update` (atau `run-db-update.bat`) untuk migrate + seed. Untuk hapus DB lama (bintang_global) dan buat DB baru lengkap: `npm run db:recreate`. Backend juga sync schema saat start (tanpa ALTER jika ada view).
- **Frontend** dan **backend** jalan bersamaan; buka http://localhost:3000 untuk UI, API di http://localhost:5000/api/v1.
- **Port sibuk?** Gunakan `run-project.bat` untuk membebaskan port 5000 dan 3000 lalu start, atau `stop-project.bat` hanya untuk stop.

## Akun setelah seed

Password semua: **Password123**

Lihat daftar lengkap di **backend/SEED_ACCOUNTS.md** (Super Admin, Admin Pusat, Admin Cabang, Invoice, Hotel, Visa, Tiket, Bus, Accounting, dan 3 Owner contoh).

## Scripts

| Perintah | Keterangan |
|----------|------------|
| `npm start` | Jalankan backend + frontend (concurrently) |
| `npm run db:update` | Migrate + seed database (cabang, akun semua role, 3 owner) |
| `npm run migrate` | Jalankan migrasi saja (folder backend) |
| `npm run seed` | Jalankan seed saja (folder backend) |
| `npm run seed:undo` | Hapus data seed |
| `npm run build` | Build frontend untuk production |

**Windows:** `run-db-update.bat` = update DB; `run-project.bat` = bebaskan port lalu start; `stop-project.bat` = stop proses di port 5000/3000.

## Flow peran (ringkas)

- **Admin Pusat**: Dashboard rekap cabang, rekap gabungan, buka cabang + akun, buat akun Bus/Hotel, konfigurasi harga/availability general, flyer/template, MOU.
- **Admin Cabang**: Dashboard cabang, owner di cabang, personil, konfigurasi harga cabang, proses owner baru (MOU, deposit, aktivasi), kirim hasil order ke owner.
- **Role Invoice**: Buat invoice, verifikasi pembayaran, unblock.
- **Role Hotel**: Order hotel, status pekerjaan + nomor kamar, ketersediaan kamar/makan (read-only harga).
- **Role Visa / Tiket**: Order visa/tiket, update status sampai terbit, upload dokumen, notifikasi owner/invoice.
- **Role Bus**: Order bus, tiket bus, status kedatangan/keberangkatan/kepulangan, export Excel/PDF.
- **Role Accounting**: Dashboard piutang/terbayar, aging, daftar pembayaran, invoice.
- **Super Admin**: Monitoring, statistik, logs, maintenance, tampilan, bahasa, deploy.

Bahasa aplikasi diatur oleh Super Admin (Indonesia, Inggris, Arab).
