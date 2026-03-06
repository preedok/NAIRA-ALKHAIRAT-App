#!/bin/bash
# =============================================================================
# BGG App - VPS Complete Setup Script
# Domain: insancitaintegrasi.id
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
NODE_VERSION="20"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   BGG App - Complete VPS Setup${NC}"
echo -e "${BLUE}   Domain: $DOMAIN${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Update system
echo -e "${YELLOW}>>> Updating system packages...${NC}"
apt update && apt upgrade -y

# Install essential packages
echo -e "${YELLOW}>>> Installing essential packages...${NC}"
apt install -y curl wget git build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban

# Setup firewall
echo -e "${YELLOW}>>> Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# Install Node.js
echo -e "${YELLOW}>>> Installing Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs
node --version
npm --version

# Install PM2
echo -e "${YELLOW}>>> Installing PM2...${NC}"
npm install -g pm2
pm2 startup systemd -u root --hp /root

# Install PostgreSQL
echo -e "${YELLOW}>>> Installing PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Setup PostgreSQL database and user
echo -e "${YELLOW}>>> Setting up PostgreSQL database...${NC}"
sudo -u postgres psql <<EOF
-- Drop existing if any
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};

-- Create user and database
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and setup extensions
\c ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

echo -e "${GREEN}Database ${DB_NAME} created with user ${DB_USER}${NC}"

# Install Nginx
echo -e "${YELLOW}>>> Installing Nginx...${NC}"
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# Install Certbot for SSL
echo -e "${YELLOW}>>> Installing Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Create app directory
echo -e "${YELLOW}>>> Creating application directory...${NC}"
mkdir -p $APP_DIR
mkdir -p /var/www/certbot

# Clone repository (will need GitHub setup)
echo -e "${YELLOW}>>> Cloning repository...${NC}"
cd /var/www
if [ -d "$APP_DIR" ] && [ "$(ls -A $APP_DIR)" ]; then
    echo "Directory exists, pulling latest..."
    cd $APP_DIR
    git pull origin main
else
    # You need to set up GitHub access first
    echo -e "${YELLOW}Please clone the repository manually:${NC}"
    echo "git clone https://github.com/YOUR_USERNAME/BGG_App.git $APP_DIR"
fi

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   Base VPS Setup Complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "Database credentials:"
echo -e "  Host: localhost"
echo -e "  Port: 5432"
echo -e "  Database: ${DB_NAME}"
echo -e "  Username: ${DB_USER}"
echo -e "  Password: ${DB_PASS}"
echo ""
