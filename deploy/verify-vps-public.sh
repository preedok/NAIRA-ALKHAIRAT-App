#!/bin/bash
# Jalankan di VPS (SSH) setelah deploy. Membantu diagnosa ERR_CONNECTION_TIMED_OUT dari browser.
set -e
echo "=== IP publik (bandingkan dengan DNS A record subdomain dev) ==="
curl -4 -s --connect-timeout 5 https://ifconfig.me/ip 2>/dev/null || curl -4 -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "(gagal ambil IP publik)"
echo ""
echo "=== Listen port 80 / 443 (harus ada nginx) ==="
sudo ss -tlnp | grep -E ':80|:443' || true
echo ""
echo "=== Nginx ==="
systemctl is-active nginx 2>/dev/null || true
sudo nginx -t 2>&1 || true
echo ""
echo "=== UFW (jika aktif: harus ALLOW 80,443) ==="
sudo ufw status 2>/dev/null || echo "ufw tidak terpasang atau tidak aktif"
echo ""
echo "=== Backend lokal (PM2 harus jalan) ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 3 http://127.0.0.1:5000/health 2>/dev/null || echo "Backend tidak jawab di :5000"
pm2 list 2>/dev/null | head -20 || true
echo ""
echo "=== SSL SAN (cert harus mencakup subdomain dev, kalau tidak: error sertifikat di browser) ==="
if [ -r /etc/letsencrypt/live/insancitaintegrasi.id/fullchain.pem ]; then
  sudo openssl x509 -in /etc/letsencrypt/live/insancitaintegrasi.id/fullchain.pem -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" || true
else
  echo "File cert tidak ada di path default — jalankan certbot."
fi
echo ""
echo "Selesai. Jika :443 tidak listen atau UFW DENY, perbaiki lalu reload nginx."
