#!/bin/bash

# ===========================================
# BGG Backend Deployment Script
# ===========================================
# Script ini bisa dijalankan manual atau via webhook
# Usage: ./deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="${APP_DIR:-/var/www/bgg-app}"
BRANCH="${BRANCH:-master}"
PM2_APP_NAME="${PM2_APP_NAME:-bgg-backend}"

echo -e "${YELLOW}=== BGG Backend Deployment Started ===${NC}"
echo "Timestamp: $(date)"
echo "Directory: $APP_DIR/backend"
echo "Branch: $BRANCH"
echo ""

# Navigate to backend directory
cd "$APP_DIR/backend"

# Store current commit for rollback if needed
PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo -e "${YELLOW}Current commit: $PREVIOUS_COMMIT${NC}"

# Pull latest changes
echo -e "${YELLOW}>>> Pulling latest changes from $BRANCH...${NC}"
git fetch origin $BRANCH
git reset --hard origin/$BRANCH

NEW_COMMIT=$(git rev-parse HEAD)
echo -e "${GREEN}New commit: $NEW_COMMIT${NC}"

# Check if there are actual changes
if [ "$PREVIOUS_COMMIT" == "$NEW_COMMIT" ]; then
    echo -e "${YELLOW}No new changes detected. Skipping deployment.${NC}"
    exit 0
fi

# Show what changed
echo -e "${YELLOW}>>> Changes in this deployment:${NC}"
git log --oneline $PREVIOUS_COMMIT..$NEW_COMMIT

# Install dependencies
echo -e "${YELLOW}>>> Installing dependencies...${NC}"
npm ci --production

# Run database migrations
echo -e "${YELLOW}>>> Running database migrations...${NC}"
npm run migrate

# Restart the application
echo -e "${YELLOW}>>> Restarting application...${NC}"
if pm2 describe $PM2_APP_NAME > /dev/null 2>&1; then
    pm2 restart $PM2_APP_NAME --update-env
else
    echo "PM2 process not found, starting new process..."
    pm2 start src/server.js --name $PM2_APP_NAME
fi

# Save PM2 process list
pm2 save

# Health check
echo -e "${YELLOW}>>> Performing health check...${NC}"
sleep 3

if pm2 describe $PM2_APP_NAME | grep -q "online"; then
    echo -e "${GREEN}✅ Application is running!${NC}"
    pm2 status
else
    echo -e "${RED}❌ Application failed to start! Rolling back...${NC}"
    git reset --hard $PREVIOUS_COMMIT
    npm ci --production
    pm2 restart $PM2_APP_NAME --update-env
    echo -e "${YELLOW}Rolled back to: $PREVIOUS_COMMIT${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Deployment Completed Successfully ===${NC}"
echo "Timestamp: $(date)"
