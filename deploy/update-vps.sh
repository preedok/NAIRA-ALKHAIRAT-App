#!/bin/bash
# Update deploy: pull kode terbaru + rebuild backend & frontend + sinkron nginx. Jalankan di VPS (SSH).
set -e
APP_PATH="${APP_PATH:-/var/www/bgg-app}"
echo "=== Update deploy @ $APP_PATH ==="
cd "$APP_PATH"
git fetch origin master
git reset --hard origin/master

echo "=== Backend ==="
cd "$APP_PATH/backend"
npm ci
npm run migrate 2>/dev/null || true
pm2 restart bgg-backend --update-env || pm2 start src/server.js --name bgg-backend

echo "=== Frontend ==="
cd "$APP_PATH/frontend"
npm ci
npm run build

echo "=== Nginx (dari repo deploy/nginx.conf) ==="
if [ -f "$APP_PATH/deploy/nginx.conf" ]; then
  sudo cp "$APP_PATH/deploy/nginx.conf" /etc/nginx/sites-available/bgg-app
  sudo ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/bgg-app
  sudo nginx -t
  sudo systemctl reload nginx
  echo "Nginx reload OK."
else
  echo "SKIP: $APP_PATH/deploy/nginx.conf tidak ada."
fi

echo "=== Selesai ==="
pm2 status
echo ""
echo "Cek DNS: nslookup dev.bintangglobalgrup.insancitaintegrasi.id harus sama dengan IP publik VPS."
echo "Di VPS jalankan: bash $APP_PATH/deploy/verify-vps-public.sh"
