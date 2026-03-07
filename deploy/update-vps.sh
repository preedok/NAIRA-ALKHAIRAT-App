#!/bin/bash
# Update deploy: pull kode terbaru + rebuild backend & frontend. Jalankan di VPS (SSH).
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

echo "=== Selesai ==="
pm2 status
