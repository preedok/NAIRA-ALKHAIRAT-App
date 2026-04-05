# Deploy ke VPS dengan password SSH (tanpa GitHub credentials di VPS)
# Pakai: tar + pscp + plink. Jalankan dari repo root: .\deploy\deploy-vps-password.ps1
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

$tar = Join-Path $env:TEMP "bgg-app-deploy.tar"
if (Test-Path $tar) { Remove-Item $tar -Force }

Write-Host "Membuat arsip (exclude node_modules, .git)..." -ForegroundColor Cyan
& tar -c -f $tar --exclude=node_modules --exclude=.git --exclude=uploads .
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat tar" -ForegroundColor Red; exit 1 }

Write-Host "Upload ke VPS..." -ForegroundColor Cyan
& $Pscp -batch -pw $VPS_PASS -hostkey $HOSTKEY $tar "${VPS_USER}@${VPS_HOST}:${APP_PATH}/"
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
# Hapus sisa file yang sudah tidak ada di repo (tar tidak menghapus path lama di VPS)
rm -rf frontend/src/pages/dashboard/rekap
mkdir -p $APP_PATH/uploads/mou $APP_PATH/uploads/registration-payment $APP_PATH/uploads/payment-proofs $APP_PATH/uploads/refund-proofs $APP_PATH/uploads/ticket-docs $APP_PATH/uploads/visa-docs $APP_PATH/uploads/hotel-docs $APP_PATH/uploads/siskopatuh-docs $APP_PATH/uploads/jamaah-data $APP_PATH/uploads/manifest/visa $APP_PATH/uploads/manifest/ticket
rm -f frontend/src/pages/dashboard/superadmin/SuperAdminUsersStatusPage.tsx
rm -f frontend/src/pages/dashboard/accounting/AccountingPurchasingPage.tsx frontend/src/pages/dashboard/accounting/AccountingPurchasingSuppliersPage.tsx frontend/src/pages/dashboard/accounting/AccountingPurchasingOrdersPage.tsx frontend/src/pages/dashboard/accounting/AccountingPurchasingInvoicesPage.tsx frontend/src/pages/dashboard/accounting/AccountingPurchasingPaymentsPage.tsx
rm -rf frontend/src/pages/dashboard/rms
cp -a backend/.env.bak backend/.env 2>/dev/null || true
cp -a frontend/.env.production.bak frontend/.env.production 2>/dev/null || true
echo '=== Backend ==='
cd $APP_PATH/backend && npm ci$clearBlock
(npm run migrate 2>/dev/null || true)
npm run ensure:hotel-monthly-component
npm run ensure:refunds-payout-sender
(npm run ensure:owner-manual-columns 2>/dev/null || true)
(npm run seed:kabupaten 2>/dev/null || true)
# seed:kabupaten = isi master kabupaten/kota dari API data-indonesia (jika tabel masih kosong)
(npm run sync:wilayah 2>/dev/null || true)
# sync:wilayah = isi provinsi.wilayah_id & branch.provinsi_id yang masih null dari master
(npm run sync:location 2>/dev/null || true)
pm2 delete bgg-backend 2>/dev/null || true
cd $APP_PATH/backend && pm2 start src/server.js --name bgg-backend
pm2 save
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/health || echo "health-fail"
echo '=== Frontend ==='
cd $APP_PATH/frontend && npm ci && npm run build
if docker ps --format '{{.Names}}' | grep -qx insancita-integrasi-nginx-1; then
  echo '>>> Salin frontend/build ke container nginx:/var/www/bgg-frontend (compose tidak bind-mount folder ini)...'
  docker exec insancita-integrasi-nginx-1 mkdir -p /var/www/bgg-frontend
  docker cp $APP_PATH/frontend/build/. insancita-integrasi-nginx-1:/var/www/bgg-frontend/
fi
if [ -f $APP_PATH/deploy/nginx.conf ]; then
  sudo cp $APP_PATH/deploy/nginx.conf /etc/nginx/sites-available/bgg-app
  sudo ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/bgg-app
  if sudo nginx -t 2>/dev/null; then
    (sudo systemctl is-active --quiet nginx && sudo systemctl reload nginx || sudo systemctl start nginx) || true
  fi
  echo 'Host nginx: ok atau dilewati (mis. port 80/443 dipakai Docker).'
fi
if [ -f $APP_PATH/deploy/vps-insancita-docker-nginx.conf ] && docker ps --format '{{.Names}}' | grep -qx insancita-integrasi-nginx-1; then
  cp $APP_PATH/deploy/vps-insancita-docker-nginx.conf /var/www/insancita-integrasi/infra/nginx.conf
  if docker volume inspect insancita-integrasi_letsencrypt >/dev/null 2>&1; then
    echo '>>> Sync Lets Encrypt host -> volume Docker nginx (volume ini bukan bind ke /etc/letsencrypt host)...'
    docker run --rm -v insancita-integrasi_letsencrypt:/dst -v /etc/letsencrypt:/src:ro alpine sh -c 'mkdir -p /dst/live /dst/archive /dst/renewal /dst/renewal-hooks && cp -a /src/live/. /dst/live/ && cp -a /src/archive/. /dst/archive/ && cp -a /src/renewal/. /dst/renewal/ 2>/dev/null; cp -a /src/renewal-hooks/. /dst/renewal-hooks/ 2>/dev/null; true'
  fi
  docker exec insancita-integrasi-nginx-1 nginx -t && docker exec insancita-integrasi-nginx-1 nginx -s reload && echo 'Docker nginx (dev subdomain) OK.' || echo 'Docker nginx reload gagal (cek manual).'
fi
echo DEPLOY_DONE
"@
$remote = $remote -replace "`r`n", "`n"

Write-Host "Menjalankan install & build di VPS..." -ForegroundColor Cyan
$remote | & $Plink -ssh -batch -pw $VPS_PASS -hostkey $HOSTKEY "${VPS_USER}@${VPS_HOST}" "bash -s"
$code = $LASTEXITCODE
if ($code -eq 0) { Write-Host "`nDeploy selesai." -ForegroundColor Green } else { Write-Host "`nDeploy gagal (exit $code)." -ForegroundColor Red; exit $code }
