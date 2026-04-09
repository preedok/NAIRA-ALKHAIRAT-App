# Deploy ke VPS dari Windows (tanpa GitHub Actions)
# Jalankan: PowerShell -ExecutionPolicy Bypass -File deploy/run-deploy-from-windows.ps1
# Atau: .\deploy\run-deploy-from-windows.ps1 -VPS_HOST "IP_PUBLIK_VPS_ANDA"
#
# PENTING: IP di bawah HARUS sama dengan record DNS A untuk dev.bintangglobalgrup.insancitaintegrasi.id
# Kalau browser ERR_CONNECTION_TIMED_OUT ke dev URL, berarti port 443 di IP ini tidak terbuka dari internet
# (ufw, firewall cloud, nginx tidak listen, atau DNS mengarah ke server yang salah).

param(
  [string]$VPS_HOST = "187.124.90.214",
  [string]$VPS_USER = "root"
)

$SCRIPT = @"
set -e
cd /var/www/bgg-app
git fetch origin master
git reset --hard origin/master
cd backend && npm ci && (npm run migrate 2>/dev/null || true) && npm run ensure:refunds-proof-transfer-at
pm2 restart bgg-backend --update-env || pm2 start src/server.js --name bgg-backend
cd /var/www/bgg-app/frontend && npm ci && npm run build
if [ -f /var/www/bgg-app/deploy/nginx.conf ]; then
  sudo cp /var/www/bgg-app/deploy/nginx.conf /etc/nginx/sites-available/bgg-app
  sudo ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/bgg-app
  sudo nginx -t && sudo systemctl reload nginx
fi
echo '=== Deploy selesai ===' && pm2 status
"@

Write-Host "Deploy ke VPS ${VPS_USER}@${VPS_HOST} ..." -ForegroundColor Cyan
Write-Host " (masukkan password SSH bila diminta)" -ForegroundColor Yellow
Write-Host " Setelah sukses, pastikan DNS A subdomain dev mengarah ke $VPS_HOST dan firewall mengizinkan TCP 80/443." -ForegroundColor DarkGray
$SCRIPT | ssh "${VPS_USER}@${VPS_HOST}" "bash -s"
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDeploy berhasil." -ForegroundColor Green
  Write-Host "Tes koneksi HTTPS ke VPS: Test-NetConnection -ComputerName $VPS_HOST -Port 443" -ForegroundColor DarkGray
} else {
  Write-Host "`nDeploy gagal (exit $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}
