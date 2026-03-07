-- Jalankan di database production jika kolom is_mou_owner belum ada.
-- Contoh: psql -U postgres -d nama_database -f fix-owner-profiles-is-mou-owner.sql
-- Atau dari backend: node -e "require('./src/config/database').default.query(\"ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS is_mou_owner BOOLEAN NOT NULL DEFAULT false\").then(() => process.exit(0))"

ALTER TABLE owner_profiles
ADD COLUMN IF NOT EXISTS is_mou_owner BOOLEAN NOT NULL DEFAULT false;

UPDATE owner_profiles SET is_mou_owner = true;
