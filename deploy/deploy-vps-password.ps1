# Deploy ke VPS dengan password SSH (tanpa GitHub credentials di VPS)
# Pakai: tar + pscp + plink. Jalankan dari repo root: .\deploy\deploy-vps-password.ps1

$ErrorActionPreference = "Stop"
$VPS_HOST = "187.124.90.214"
$VPS_USER = "root"
$VPS_PASS = "Sarolangun99@"
$HOSTKEY = "SHA256:8WOOfDNL3BKkVPtkBOGWcHS/a77WegKt1nN1GPOvHkA"
$APP_PATH = "/var/www/bgg-app"
$Plink = "C:\Program Files\PuTTY\plink.exe"
$Pscp = "C:\Program Files\PuTTY\pscp.exe"

if (-not (Test-Path $Plink)) { Write-Host "PuTTY plink tidak ditemukan: $Plink" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $Pscp))  { Write-Host "PuTTY pscp tidak ditemukan: $Pscp" -ForegroundColor Red; exit 1 }

$root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $root
$tar = Join-Path $env:TEMP "bgg-app-deploy.tar"
if (Test-Path $tar) { Remove-Item $tar -Force }

Write-Host "Membuat arsip (exclude node_modules, .git)..." -ForegroundColor Cyan
& tar -c -f $tar --exclude=node_modules --exclude=.git .
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat tar" -ForegroundColor Red; exit 1 }

Write-Host "Upload ke VPS..." -ForegroundColor Cyan
& $Pscp -batch -pw $VPS_PASS -hostkey $HOSTKEY $tar "${VPS_USER}@${VPS_HOST}:${APP_PATH}/"
if ($LASTEXITCODE -ne 0) { Remove-Item $tar -ErrorAction SilentlyContinue; Write-Host "Upload gagal" -ForegroundColor Red; exit 1 }
Remove-Item $tar -Force -ErrorAction SilentlyContinue

# Gunakan LF saja agar bash di VPS tidak dapat \r
$remote = @"
set -e
cd $APP_PATH
cp -a backend/.env backend/.env.bak 2>/dev/null || true
cp -a frontend/.env.production frontend/.env.production.bak 2>/dev/null || true
tar xf bgg-app-deploy.tar
rm -f bgg-app-deploy.tar
rm -f frontend/src/pages/dashboard/superadmin/SuperAdminUsersStatusPage.tsx
cp -a backend/.env.bak backend/.env 2>/dev/null || true
cp -a frontend/.env.production.bak frontend/.env.production 2>/dev/null || true
echo '=== Backend ==='
cd $APP_PATH/backend && npm ci && npm run migrate
node scripts/clear-orders-invoices.js
node scripts/set-all-passwords.js 2>/dev/null || true
pm2 delete bgg-backend 2>/dev/null || true
cd $APP_PATH/backend && pm2 start src/server.js --name bgg-backend
pm2 save
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/health || echo "health-fail"
echo '=== Frontend ==='
cd $APP_PATH/frontend && npm ci && npm run build
echo DEPLOY_DONE
"@
$remote = $remote -replace "`r`n", "`n"

Write-Host "Menjalankan install & build di VPS..." -ForegroundColor Cyan
$remote | & $Plink -ssh -batch -pw $VPS_PASS -hostkey $HOSTKEY "${VPS_USER}@${VPS_HOST}" "bash -s"
$code = $LASTEXITCODE
if ($code -eq 0) { Write-Host "`nDeploy selesai." -ForegroundColor Green } else { Write-Host "`nDeploy gagal (exit $code)." -ForegroundColor Red; exit $code }
