# Bintang Global Group — Enterprise B2B Platform

Platform manajemen terintegrasi untuk layanan umroh: hotel, visa, tiket, bus, paket, invoice, dan multi-role (Admin Pusat, Admin Koordinator, Invoice/Visa/Tiket Koordinator, Hotel, Bus, Accounting, Owner).

**Stack:** Backend (Node.js + Express + PostgreSQL), Frontend (React), Mobile (React Native Android), Landing Page (terintegrasi).

---

## Quick Start

```bash
# 1. Install dependencies (root + backend + frontend + mobile)
npm run install:all

# 2. Buat database PostgreSQL (nama: db_bgg_group)
createdb -U postgres db_bgg_group

# 3. Environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Isi backend/.env: DB_NAME=db_bgg_group, DB_USERNAME, DB_PASSWORD, dll.
# Frontend .env: REACT_APP_API_URL=http://localhost:5000/api/v1

# 4. Migrate & seed database
npm run db:migrate
npm run db:update
# db:update = migrate + sync + seed (cabang, akun semua role, owner contoh, produk)

# 5. Jalankan aplikasi
npm start
# Backend: http://localhost:5000 | Frontend: http://localhost:3000
```

- **Landing page** (untuk tamu): buka http://localhost:3000 — Daftar Partner / Masuk.
- **Mobile (Owner):** `cd mobile` lalu `npm start` dan `npm run android` (emulator/device).

---

## Struktur Project

| Folder       | Isi |
|-------------|-----|
| `backend/`  | REST API (Express, Sequelize, PostgreSQL), migrate, seed, script clear data |
| `frontend/` | React app (dashboard + landing page) |
| `mobile/`   | React Native app (Owner) — Android |
| `docs/`     | Dokumentasi proses bisnis, arsitektur, workflow |
| Root        | `PENAWARAN_HARGA.html`, `SURAT_KONTRAK_KERJASAMA.html`, script generate PDF |

---

## Scripts (Root)

| Perintah | Keterangan |
|----------|------------|
| `npm run install:all` | Install dependency root + backend + frontend + mobile |
| `npm start` | Jalankan backend + frontend (tanpa mobile) |
| `npm run dev` | Backend + frontend (development, dengan db:migrate pre-run) |
| `npm run start:backend` | Backend saja |
| `npm run start:frontend` | Frontend saja |
| `npm run start:mobile` | Metro (mobile) |
| `npm run db:migrate` | Jalankan migrasi (backend) |
| `npm run db:update` | Migrate + sync + seed (backend) |
| `npm run migrate` | Sama dengan db:migrate |
| `npm run seed` | Seed saja (backend) |
| `npm run seed:undo` | Undo seed (backend) |
| `npm run build` | Build frontend production |
| `npm run generate:penawaran-pdf` | Generate PENAWARAN_HARGA.pdf dari PENAWARAN_HARGA.html |

### Scripts (Backend — dari folder backend)

| Perintah | Keterangan |
|----------|------------|
| `npm run clear:orders-invoices` | Hapus semua data order, invoice, pembayaran, progres, notifikasi (data master tetap) |
| `npm run db:recreate` | Hapus DB lama, buat db_bgg_group baru, lalu migrate + seed |
| `npm run generate:payment-proofs` | Generate contoh bukti pembayaran |

**Hapus data order & invoice dari root:**  
`cd backend && npm run clear:orders-invoices`

---

## Akun Setelah Seed

Password semua: **Password123**

Daftar lengkap: **backend/SEED_ACCOUNTS.md** (Super Admin, Admin Pusat, Admin Koordinator, Invoice/Visa/Tiket Koordinator, Hotel, Bus, Accounting, Owner contoh).

---

## Dokumen Bisnis (Root)

| File | Keterangan |
|------|-------------|
| `PENAWARAN_HARGA.html` | Penawaran harga sewa aplikasi (per bulan / 3 bln / 6 bln / tahun, tanpa/dengan server), rincian modul, biaya pengembangan per modul |
| `SURAT_KONTRAK_KERJASAMA.html` | Draft surat perjanjian kerjasama PT Insan Cita Integrasi & PT Bintang Global Group |
| `PENAWARAN_HARGA.pdf` | Generate dari HTML: `npm run generate:penawaran-pdf` (perlu Puppeteer) |

Buka file `.html` di browser; untuk PDF bisa Print → Save as PDF atau pakai script generate.

---

## Dokumentasi & Presentasi

- **Workflow proses bisnis:** `docs/WORKFLOW_PROSES_BISNIS_PRESENTASI.md` (generate PDF via backend script bila ada).
- **Arsitektur & scope role:** `docs/ARCHITECTURE_AND_SCOPE.md`
- **Master business process:** `docs/MASTER_BUSINESS_PROCESS.md`
- **Emulator (mobile):** `mobile/docs/EMULATOR_TROUBLESHOOTING.md`

---

## Role (Ringkas)

| Role | Scope |
|------|--------|
| **Super Admin** | Monitoring, logs, maintenance |
| **Admin Pusat** | Seluruh cabang, rekap, konfigurasi global |
| **Admin Koordinator** | Wilayah (cabang dalam wilayahnya) |
| **Invoice / Visa / Tiket Koordinator** | Order & invoice dalam wilayah; proses visa/tiket |
| **Role Hotel / Role Bus** | Pekerjaan hotel, bus (scope cabang/wilayah) |
| **Role Accounting** | Laporan keuangan, aging, rekening koran |
| **Owner** | Order & invoice milik sendiri; akses mobile |

---

## Persyaratan

- Node.js ≥ 18
- PostgreSQL
- (Mobile) Android Studio / SDK untuk build Android

---

## Lisensi & Author

**Bintang Global Group** — Enterprise B2B Platform for Umroh Services.
