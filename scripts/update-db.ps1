# ============================================
# Bintang Global - Update database otomatis
# Menjalankan: migrate lalu seed
# ============================================

$ErrorActionPreference = "Stop"
# Dari folder scripts, naik satu tingkat = root project
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

Write-Host "Database update: migrate + seed" -ForegroundColor Cyan
Write-Host "Backend: $backend" -ForegroundColor Gray
Write-Host ""

Set-Location $backend

Write-Host "[1/2] Running migrations..." -ForegroundColor Yellow
npm run migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrate failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] Running seeders..." -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "Seed failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Database update selesai." -ForegroundColor Green
Write-Host "Password semua akun: Password123 (lihat backend/SEED_ACCOUNTS.md)" -ForegroundColor Gray
