#!/bin/bash
# =============================================================================
# BGG App - FULL AUTOMATED DEPLOYMENT SCRIPT
# Domain: insancitaintegrasi.id
# Run as root on fresh Ubuntu VPS
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DOMAIN="insancitaintegrasi.id"
APP_DIR="/var/www/bgg-app"
GITHUB_REPO="https://github.com/preedok/BGG_App.git"
DB_NAME="db_bgg_group"
DB_USER="bgg_user"
DB_PASS="BGG_Secure_Pass_2024!"
NODE_VERSION="20"

print_header() {
    echo ""
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}   $1${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# =============================================================================
print_header "BGG App Full Deployment - Starting"
echo "Domain: $DOMAIN"
echo "GitHub: $GITHUB_REPO"
echo "Database: $DB_NAME"
echo ""

# =============================================================================
print_header "Step 1: System Update & Essential Packages"
# =============================================================================

print_step "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

print_step "Installing essential packages..."
apt install -y curl wget git build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban \
    unzip htop

print_success "System packages installed"

# =============================================================================
print_header "Step 2: Firewall Configuration"
# =============================================================================

print_step "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

print_success "Firewall configured"
ufw status

# =============================================================================
print_header "Step 3: Node.js Installation"
# =============================================================================

print_step "Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi

print_success "Node.js $(node --version) installed"
print_success "NPM $(npm --version) installed"

# Install PM2 globally
print_step "Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
print_success "PM2 installed"

# =============================================================================
print_header "Step 4: PostgreSQL Installation & Setup"
# =============================================================================

print_step "Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

print_step "Creating database and user..."
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

print_success "Database ${DB_NAME} created"

# =============================================================================
print_header "Step 5: Nginx Installation"
# =============================================================================

print_step "Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

print_success "Nginx installed"

# =============================================================================
print_header "Step 6: Certbot (SSL) Installation"
# =============================================================================

print_step "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

print_success "Certbot installed"

# =============================================================================
print_header "Step 7: Clone Application from GitHub"
# =============================================================================

print_step "Cloning repository..."
mkdir -p /var/www
cd /var/www

if [ -d "$APP_DIR" ]; then
    print_step "Directory exists, pulling latest changes..."
    cd $APP_DIR
    git fetch origin master
    git reset --hard origin/master
else
    git clone $GITHUB_REPO $APP_DIR
    cd $APP_DIR
fi

print_success "Repository cloned/updated"

# =============================================================================
print_header "Step 8: Backend Setup"
# =============================================================================

cd $APP_DIR/backend

print_step "Creating backend .env file..."
JWT_SECRET=$(openssl rand -base64 32)

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
JWT_SECRET=${JWT_SECRET}
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

print_success "Backend .env created"

print_step "Installing backend dependencies..."
npm ci --production

print_step "Creating uploads directory..."
mkdir -p uploads logs
chmod 755 uploads logs

print_step "Running database migrations..."
npm run migrate

print_step "Running database seeders..."
npm run seed || print_step "Seeders may have already run"

print_step "Starting backend with PM2..."
pm2 delete bgg-backend 2>/dev/null || true
pm2 start src/server.js --name bgg-backend
pm2 save

print_success "Backend deployed and running"

# =============================================================================
print_header "Step 9: Frontend Setup"
# =============================================================================

cd $APP_DIR/frontend

print_step "Creating frontend .env file..."
cat > .env <<EOF
REACT_APP_API_URL=https://${DOMAIN}/api/v1
REACT_APP_SOCKET_URL=https://${DOMAIN}
REACT_APP_NAME=Bintang Global Group
EOF

print_success "Frontend .env created"

print_step "Installing frontend dependencies..."
npm ci

print_step "Building frontend (this may take several minutes)..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

print_success "Frontend build complete"

# =============================================================================
print_header "Step 10: Nginx Configuration"
# =============================================================================

print_step "Creating Nginx configuration..."

# First, create a simple HTTP config for certbot
cat > /etc/nginx/sites-available/bgg-app <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        root /var/www/bgg-app/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
    
    location /uploads/ {
        alias /var/www/bgg-app/backend/uploads/;
        expires 30d;
    }
}
EOF

# Create certbot directory
mkdir -p /var/www/certbot

# Enable site
ln -sf /etc/nginx/sites-available/bgg-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx

print_success "Nginx HTTP configured"

# =============================================================================
print_header "Step 11: SSL Certificate Setup"
# =============================================================================

print_step "Obtaining SSL certificate from Let's Encrypt..."

# Get SSL certificate
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} \
    --non-interactive --agree-tos --email admin@${DOMAIN} \
    --redirect || {
    print_error "Certbot failed. Make sure DNS is pointing to this server."
    print_step "You can run certbot manually later: certbot --nginx -d ${DOMAIN}"
}

# Setup auto-renewal cron
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

print_success "SSL certificate configured"

# =============================================================================
print_header "Step 12: Final Verification"
# =============================================================================

echo ""
echo -e "${BLUE}--- PM2 Status ---${NC}"
pm2 status

echo ""
echo -e "${BLUE}--- Nginx Status ---${NC}"
systemctl status nginx --no-pager -l | head -20

echo ""
echo -e "${BLUE}--- PostgreSQL Status ---${NC}"
systemctl status postgresql --no-pager -l | head -10

# Health check
echo ""
print_step "Testing backend API..."
sleep 3
curl -s http://localhost:5000/api/v1/health || echo "API health check endpoint not available"

# =============================================================================
print_header "DEPLOYMENT COMPLETE!"
# =============================================================================

echo -e "${GREEN}"
echo "=============================================="
echo "   BGG App Successfully Deployed!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "Application URLs:"
echo "  Frontend: https://${DOMAIN}"
echo "  API:      https://${DOMAIN}/api/v1"
echo ""
echo "Database Credentials:"
echo "  Host:     localhost"
echo "  Port:     5432"
echo "  Database: ${DB_NAME}"
echo "  Username: ${DB_USER}"
echo "  Password: ${DB_PASS}"
echo ""
echo "Useful Commands:"
echo "  pm2 status              - Check app status"
echo "  pm2 logs bgg-backend    - View backend logs"
echo "  pm2 restart bgg-backend - Restart backend"
echo "  nginx -t                - Test nginx config"
echo "  systemctl reload nginx  - Reload nginx"
echo ""
echo -e "${GREEN}Done!${NC}"
