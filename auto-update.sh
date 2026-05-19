#!/bin/bash
# ============================================
# Tashira Auto-Update Script
# Runs every minute via cron job
# ============================================

REPO_DIR="/var/www/tashira"
LOG_FILE="/var/log/tashira-updates.log"
LOCK_FILE="/tmp/tashira-update.lock"

# Prevent multiple simultaneous runs
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
touch "$LOCK_FILE"

cd "$REPO_DIR" || exit 1

# Fetch latest changes from GitHub
git fetch origin main > /dev/null 2>&1

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ] && [ -n "$REMOTE" ]; then
    echo "[$(date)] New update found! Pulling..." >> "$LOG_FILE"
    
    git pull origin main >> "$LOG_FILE" 2>&1
    
    echo "[$(date)] Installing dependencies..." >> "$LOG_FILE"
    npm install >> "$LOG_FILE" 2>&1
    
    echo "[$(date)] Building..." >> "$LOG_FILE"
    npm run build >> "$LOG_FILE" 2>&1
    
    echo "[$(date)] Restarting nginx..." >> "$LOG_FILE"
    systemctl restart nginx
    
    echo "[$(date)] Update completed successfully!" >> "$LOG_FILE"
    echo "---" >> "$LOG_FILE"
fi

rm -f "$LOCK_FILE"
