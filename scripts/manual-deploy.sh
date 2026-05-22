#!/bin/bash
# ============================================
# Manual Deploy - One-click deployment
# Run this on your VPS to force update NOW
# ============================================

set -e

APP_DIR="/var/www/tashira"
LOG_FILE="/var/log/tashira-deploy.log"

cd "$APP_DIR" || { echo "ERROR: Cannot cd to $APP_DIR"; exit 1; }

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "============================================"
log "  MANUAL DEPLOY STARTED"
log "============================================"

# Step 1: Reset to GitHub source of truth, then pull
log "[1/5] Resetting local changes and pulling from GitHub..."
git reset --hard HEAD | tee -a "$LOG_FILE"
git clean -fd | tee -a "$LOG_FILE"
git pull origin main | tee -a "$LOG_FILE"

# Step 2
log "[2/5] Installing dependencies..."
npm install | tail -5 | tee -a "$LOG_FILE"

# Step 3
log "[3/5] Building..."
npm run build 2>&1 | tail -10 | tee -a "$LOG_FILE"

# Step 4
log "[4/5] Restarting services..."
pm2 restart tashira --update-env 2>/dev/null || {
    log "PM2 not running, restarting nginx..."
    systemctl restart nginx
}

# Step 5
log "[5/5] Done!"
log "============================================"
log "  DEPLOY COMPLETE!"
log "  Time: $(date)"
log "  URL:  http://tashiraev.com"
log "============================================"
