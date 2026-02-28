#!/bin/bash
# Deploy script for Trading Bot SaaS
# Usage: ./scripts/deploy-vps.sh

set -e

echo "========================================="
echo "  Trading Bot SaaS - Deploy Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project directory (script is in scripts/, so go up one level)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${YELLOW}Project directory:${NC} $PROJECT_DIR"

# Step 1: Pull latest changes
echo ""
echo -e "${YELLOW}[1/7] Pulling latest changes from git...${NC}"
git pull origin master
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Git pull successful${NC}"
else
    echo -e "${RED}✗ Git pull failed${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo ""
echo -e "${YELLOW}[2/7] Installing dependencies...${NC}"
npm install --production=false
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ npm install failed${NC}"
    exit 1
fi

# Step 3: Build the application
echo ""
echo -e "${YELLOW}[3/7] Building application...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Step 4: Copy static files to standalone
echo ""
echo -e "${YELLOW}[4/7] Copying static files to standalone...${NC}"
if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/.next/static
    echo -e "${GREEN}✓ Static files copied${NC}"
else
    echo -e "${YELLOW}! Standalone directory not found, skipping static copy${NC}"
fi

# Step 5: Copy public folder
echo ""
echo -e "${YELLOW}[5/7] Copying public folder...${NC}"
if [ -d ".next/standalone" ]; then
    cp -r public .next/standalone/public 2>/dev/null || true
    echo -e "${GREEN}✓ Public folder copied${NC}"
else
    echo -e "${YELLOW}! Standalone directory not found, skipping public copy${NC}"
fi

# Step 6: Create symlinks for data files
echo ""
echo -e "${YELLOW}[6/7] Creating symlinks for data files...${NC}"

# Define symlinks to create
declare -A SYMLINKS=(
    ["signals_simple.csv"]="$PROJECT_DIR/signals_simple.csv"
    ["signals_parsed.csv"]="$PROJECT_DIR/signals_parsed.csv"
    ["signals_intradia.csv"]="$PROJECT_DIR/signals_intradia.csv"
    ["data"]="$PROJECT_DIR/data"
    ["prisma/dev.db"]="$PROJECT_DIR/prisma/dev.db"
)

# Create symlinks in standalone directory if it exists
if [ -d ".next/standalone" ]; then
    for target in "${!SYMLINKS[@]}"; do
        source="${SYMLINKS[$target]}"
        link_path=".next/standalone/$target"

        if [ -e "$source" ]; then
            # Remove existing symlink or file
            rm -rf "$link_path" 2>/dev/null || true

            # Create parent directory if needed
            mkdir -p "$(dirname "$link_path")" 2>/dev/null || true

            # Create relative symlink
            ln -sf "$source" "$link_path"
            echo -e "  ${GREEN}✓${NC} $target -> $source"
        else
            echo -e "  ${YELLOW}!${NC} $source not found, skipping"
        fi
    done
    echo -e "${GREEN}✓ Symlinks created${NC}"
else
    echo -e "${YELLOW}! Standalone directory not found, skipping symlinks${NC}"
fi

# Step 7: Restart PM2
echo ""
echo -e "${YELLOW}[7/7] Restarting PM2 process...${NC}"
pm2 restart trading-bot-saas --update-env
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PM2 restart successful${NC}"
else
    echo -e "${YELLOW}! PM2 restart returned non-zero (process may not exist yet)${NC}"
fi

# Health check
echo ""
echo -e "${YELLOW}Running health check...${NC}"
sleep 3

HEALTH_RESPONSE=$(curl -s http://localhost:3700 | head -1)

if [ -n "$HEALTH_RESPONSE" ]; then
    echo -e "${GREEN}✓ Application is responding${NC}"
    echo -e "  Response preview: ${HEALTH_RESPONSE:0:50}..."
else
    echo -e "${RED}✗ Application not responding on port 3700${NC}"
    echo -e "${YELLOW}Check PM2 logs: pm2 logs trading-bot-saas${NC}"
    exit 1
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}  ✓ DEPLOY SUCCESSFUL${NC}"
echo "========================================="
echo ""
echo "Application running at: http://localhost:3700"
echo "External URL: http://91.98.238.147:3700"
echo ""
echo "Useful commands:"
echo "  pm2 logs trading-bot-saas    - View logs"
echo "  pm2 status                   - Check status"
echo "  pm2 restart trading-bot-saas - Restart app"
echo ""
