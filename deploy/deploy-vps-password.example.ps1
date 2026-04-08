# Deploy ke VPS dengan password SSH (TEMPLATE)
# Catatan: Jangan commit kredensial. Salin file ini menjadi deploy-vps-password.ps1 secara lokal.
#
# Pakai: tar + pscp + plink. Jalankan dari repo root:
#   .\deploy\deploy-vps-password.ps1
#
# Opsional:
#   -ClearOrders                  → hapus order/invoice + terkait (tetap users & owner)
#   -ClearOrdersInvoicesOwners    → hapus order/invoice + akun owner & data terkait (CONFIRM di server)
#   -ClearInvoicesDatabase        → setelah npm ci: CONFIRM=YES clear-invoices-database-clean.js
#   -OnlyClearInvoicesDatabase    → TANPA upload/tar: hanya jalankan hapus invoice+order di VPS (cepat)

param(
  [switch]$ClearOrders,
  [switch]$ClearOrdersInvoicesOwners,
  [switch]$ClearInvoicesDatabase,
  [switch]$OnlyClearInvoicesDatabase
)

$ErrorActionPreference = "Stop"
$VPS_HOST = "YOUR_VPS_HOST"
$VPS_USER = "root"
$VPS_PASS = "YOUR_VPS_PASSWORD"
$HOSTKEY = "SHA256:YOUR_HOSTKEY"
$APP_PATH = "/var/www/bgg-app"
$Plink = "C:\Program Files\PuTTY\plink.exe"
$Pscp = "C:\Program Files\PuTTY\pscp.exe"

if (-not (Test-Path $Plink)) { Write-Host "PuTTY plink tidak ditemukan: $Plink" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $Pscp))  { Write-Host "PuTTY pscp tidak ditemukan: $Pscp" -ForegroundColor Red; exit 1 }

$root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $root

if ($OnlyClearInvoicesDatabase) {
  Write-Host "Hanya hapus invoice + order di VPS (tanpa deploy file)..." -ForegroundColor Yellow
  $onlyClear = @"
set -e
cd $APP_PATH/backend
if [ ! -f scripts/clear-invoices-database-clean.js ]; then
  echo "File scripts/clear-invoices-database-clean.js tidak ada. Deploy repo dulu (git/pull atau deploy penuh)."
  exit 1
fi
export CONFIRM=YES
node scripts/clear-invoices-database-clean.js
echo CLEAR_INVOICES_DONE
"@
  $onlyClear = $onlyClear -replace "`r`n", "`n"
  $onlyClear | & $Plink -ssh -batch -pw $VPS_PASS -hostkey $HOSTKEY "${VPS_USER}@${VPS_HOST}" "bash -s"
  $code = $LASTEXITCODE
  if ($code -eq 0) { Write-Host "`nPenghapusan invoice/order selesai." -ForegroundColor Green } else { Write-Host "`nGagal (exit $code)." -ForegroundColor Red; exit $code }
  exit 0
}

# Nama lokal unik agar tidak bentrok / terkunci oleh proses lain (upload sebelumnya, antivirus, dll.)
$tar = Join-Path $env:TEMP ("bgg-app-deploy-" + [Guid]::NewGuid().ToString("N").Substring(0, 12) + ".tar")
# Di VPS skrip remote selalu menjalankan: tar xf bgg-app-deploy.tar — unggah ke nama itu.
$tarRemoteName = "bgg-app-deploy.tar"

Write-Host "Membuat arsip (exclude node_modules, .git)..." -ForegroundColor Cyan
& tar -c -f $tar --exclude=node_modules --exclude=.git --exclude=uploads .
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat tar" -ForegroundColor Red; exit 1 }

Write-Host "Upload ke VPS..." -ForegroundColor Cyan
& $Pscp -batch -pw $VPS_PASS -hostkey $HOSTKEY $tar "${VPS_USER}@${VPS_HOST}:${APP_PATH}/${tarRemoteName}"
if ($LASTEXITCODE -ne 0) { Remove-Item $tar -ErrorAction SilentlyContinue; Write-Host "Upload gagal" -ForegroundColor Red; exit 1 }
Remove-Item $tar -Force -ErrorAction SilentlyContinue

$clearBlock = ""
if ($ClearOrdersInvoicesOwners) {
  $clearBlock = @"

echo '>>> ClearOrdersInvoicesOwners: order, invoice, akun owner + terkait (CONFIRM=YES)...'
CONFIRM=YES node scripts/clear-orders-and-owner-accounts.js
"@
} elseif ($ClearInvoicesDatabase) {
  $clearBlock = @"

echo '>>> ClearInvoicesDatabase: hapus semua invoice + order terkait (CONFIRM=YES)...'
CONFIRM=YES node scripts/clear-invoices-database-clean.js
"@
} elseif ($ClearOrders) {
  $clearBlock = @"

echo '>>> ClearOrders: menghapus data order, invoice, dan terkait...'
node scripts/clear-orders-invoices.js
"@
}

# Gunakan LF saja agar bash di VPS tidak dapat \r
$remote = @"
set -e
cd $APP_PATH
cp -a backend/.env backend/.env.bak 2>/dev/null || true
cp -a frontend/.env.production frontend/.env.production.bak 2>/dev/null || true
tar xf bgg-app-deploy.tar
rm -f bgg-app-deploy.tar
cp -a backend/.env.bak backend/.env 2>/dev/null || true
cp -a frontend/.env.production.bak frontend/.env.production 2>/dev/null || true
echo '=== Backend ==='
cd $APP_PATH/backend && npm ci$clearBlock
(npm run migrate 2>/dev/null || true)
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

