#!/bin/bash
# =============================================================================
# BGG App - Application Deployment Script
# Run this after setup-vps.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="insancitaintegrasi.id"
APP_DIR="/var/www/bgg-app"
DB_NAME="db_bgg_group"
DB_USER="bgg_user"
DB_PASS="BGG_Secure_Pass_2024!"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   BGG App - Deploying Application${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

cd $APP_DIR

# ============================================
# BACKEND SETUP
# ============================================
echo -e "${YELLOW}>>> Setting up Backend...${NC}"
cd $APP_DIR/backend

# Create production .env
cat > .env <<EOF
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_DIALECT=postgres

# JWT
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=https://${DOMAIN}

# Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Email / SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=asmadioke23@gmail.com
SMTP_PASSWORD=sarolangun99
SMTP_SECURE=false
EMAIL_FROM=noreply@${DOMAIN}
EMAIL_FROM_NAME=Bintang Global - Admin Pusat

# Logging
LOG_LEVEL=info
EOF

# Install dependencies
echo -e "${YELLOW}>>> Installing backend dependencies...${NC}"
npm ci --production

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Run database migrations
echo -e "${YELLOW}>>> Running database migrations...${NC}"
npm run migrate

# Run seeders
echo -e "${YELLOW}>>> Running database seeders...${NC}"
npm run seed || echo "Seeders may have already run"

# Start backend with PM2
echo -e "${YELLOW}>>> Starting backend with PM2...${NC}"
pm2 delete bgg-backend 2>/dev/null || true
pm2 start src/server.js --name bgg-backend -i max
pm2 save

# ============================================
# FRONTEND SETUP
# ============================================
echo -e "${YELLOW}>>> Setting up Frontend...${NC}"
cd $APP_DIR/frontend

# Create production .env
cat > .env <<EOF
REACT_APP_API_URL=https://${DOMAIN}/api/v1
REACT_APP_SOCKET_URL=https://${DOMAIN}
REACT_APP_NAME=Bintang Global Group
EOF

# Install dependencies
echo -e "${YELLOW}>>> Installing frontend dependencies...${NC}"
npm ci

# Build frontend
echo -e "${YELLOW}>>> Building frontend (this may take a few minutes)...${NC}"
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

echo -e "${GREEN}Frontend build complete!${NC}"

# ============================================
# NGINX SETUP
# ============================================
echo -e "${YELLOW}>>> Configuring Nginx...${NC}"

# Copy nginx config
cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/bgg-app

# Create symlink
ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config (will fail because SSL certs don't exist yet)
echo -e "${YELLOW}>>> Testing Nginx config (may show SSL warning)...${NC}"
nginx -t 2>/dev/null || true

# ============================================
# SSL SETUP
# ============================================
echo -e "${YELLOW}>>> Setting up SSL certificate...${NC}"

# Temporary nginx config without SSL for certbot
cat > /etc/nginx/sites-available/bgg-app-temp <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        root /var/www/bgg-app/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bgg-app-temp /etc/nginx/sites-enabled/bgg-app
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect

# Now use the full config
ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/bgg-app
rm -f /etc/nginx/sites-available/bgg-app-temp
nginx -t && systemctl reload nginx

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# ============================================
# FINAL CHECKS
# ============================================
echo -e "${YELLOW}>>> Running final checks...${NC}"

# Check PM2
pm2 status

# Check Nginx
systemctl status nginx --no-pager

# Check PostgreSQL
systemctl status postgresql --no-pager

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Application URLs:"
echo -e "  Frontend: https://${DOMAIN}"
echo -e "  API: https://${DOMAIN}/api/v1"
echo ""
echo -e "PM2 Commands:"
echo -e "  pm2 status          - Check app status"
echo -e "  pm2 logs bgg-backend - View logs"
echo -e "  pm2 restart bgg-backend - Restart app"
echo ""
