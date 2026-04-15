# Akun seed (development)

**Hanya untuk lingkungan lokal / pengembangan.** Ganti password di production dan hapus atau nonaktifkan akun contoh.

**Persyaratan:** skema PostgreSQL harus sudah sesuai model aplikasi (tabel `users` memiliki kolom seperti `branch_id`, `role`, dll.). Jika muncul error kolom tidak ada, lengkapi migrasi / `db:update` dari sumber proyek yang utuh terlebih dahulu.

## Password default

| Variabel | Nilai |
|----------|--------|
| Password login | `Password123` |
| Override | Set `DEV_SEED_PASSWORD` di `backend/.env` lalu jalankan ulang seed |

## Email & peran

| Email | Peran | Cabang |
|-------|--------|--------|
| `admin.pusat@local.dev` | Admin pusat (akses penuh operasional) | — |
| `admin.cabang@local.dev` | Admin cabang | Cabang Demo (Dev Seed) |
| `jamaah.demo@local.dev` | Jamaah (contoh) | Cabang Demo (Dev Seed) |

## Membuat / menyelaraskan akun di database

Dari folder **backend**:

```bash
npm run seed:dev-accounts
```

Atau dari **root** proyek:

```bash
npm run seed:dev-accounts
```

Skrip ini idempotent: membuat cabang demo bila belum ada, lalu membuat atau memperbarui pengguna di atas (termasuk password dan `is_active`).

## Login

Buka frontend (mis. `http://localhost:3000`), masuk dengan salah satu email di tabel dan password `Password123` (kecuali Anda mengubah `DEV_SEED_PASSWORD`).
