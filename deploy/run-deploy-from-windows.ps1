# Deploy ke VPS dari Windows (tanpa GitHub Actions)
# Jalankan: PowerShell -ExecutionPolicy Bypass -File deploy/run-deploy-from-windows.ps1
# Atau dari folder project: .\deploy\run-deploy-from-windows.ps1

$VPS_HOST = "187.124.90.214"
$VPS_USER = "root"

$SCRIPT = @"
set -e
cd /var/www/bgg-app
git fetch origin master
git reset --hard origin/master
cd backend && npm ci && npm run migrate 2>/dev/null || true
pm2 restart bgg-backend --update-env || pm2 start src/server.js --name bgg-backend
cd /var/www/bgg-app/frontend && npm ci && npm run build
echo '=== Deploy selesai ===' && pm2 status
"@

Write-Host "Deploy ke VPS $VPS_USER@$VPS_HOST ..." -ForegroundColor Cyan
Write-Host " (masukkan password SSH bila diminta)" -ForegroundColor Yellow
$SCRIPT | ssh "${VPS_USER}@${VPS_HOST}" "bash -s"
if ($LASTEXITCODE -eq 0) { Write-Host "`nDeploy berhasil." -ForegroundColor Green } else { Write-Host "`nDeploy gagal (exit $LASTEXITCODE)." -ForegroundColor Red; exit $LASTEXITCODE }
