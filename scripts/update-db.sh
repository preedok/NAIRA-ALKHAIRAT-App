#!/usr/bin/env bash
# ============================================
# Bintang Global - Update database otomatis
# Menjalankan: migrate lalu seed
# ============================================

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"

echo "Database update: migrate + seed"
echo "Backend: $BACKEND"
echo ""

cd "$BACKEND"

echo "[1/2] Running migrations..."
npm run migrate

echo ""
echo "[2/2] Running seeders..."
npm run seed

echo ""
echo "Database update selesai."
echo "Password semua akun: Password123 (lihat backend/SEED_ACCOUNTS.md)"
