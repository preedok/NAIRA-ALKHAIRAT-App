-- Master provinsi & wilayah + relasi ke cabang
-- Jalankan sekali pada database PostgreSQL aplikasi.

CREATE TABLE IF NOT EXISTS provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wilayahs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id UUID NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wilayahs_province_id ON wilayahs(province_id);

ALTER TABLE branches ADD COLUMN IF NOT EXISTS province_id UUID REFERENCES provinces(id) ON DELETE SET NULL;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS wilayah_id UUID REFERENCES wilayahs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branches_province_id ON branches(province_id);
CREATE INDEX IF NOT EXISTS idx_branches_wilayah_id ON branches(wilayah_id);
