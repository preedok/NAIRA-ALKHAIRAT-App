-- ================================================
-- Apply updates to existing bintang_global database
-- Jalankan jika DB sudah ada (mis. dari Sequelize sync) dan perlu penyesuaian
-- Contoh: psql -U postgres -d bintang_global -f scripts/apply-db-updates.sql
-- ================================================

-- Tambah role_hotel ke enum (jika DB dibuat dari bintang_global_db.sql lama tanpa role_hotel)
-- Jika error "already exists" berarti sudah ada, abaikan.
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'role_hotel';  -- PostgreSQL 15+
-- Untuk PG < 15: ALTER TYPE user_role ADD VALUE 'role_hotel';

-- Tabel product_availability dan flyer_templates dibuat otomatis oleh Sequelize sync.
-- Untuk isi data akun semua role + 3 owner, jalankan di folder backend:
--   npm run seed
-- Password default semua akun: Password123
