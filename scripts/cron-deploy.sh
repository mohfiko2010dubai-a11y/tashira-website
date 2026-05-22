#!/bin/bash
# ============================================
# Git Polling Auto-Deploy (Fallback method)
# Checks GitHub every minute for new commits
# ============================================

APP_DIR="/var/www/tashira"
LOG_FILE="/var/log/tashira-cron-deploy.log"
LOCK_FILE="/tmp/tashira-cron-deploy.lock"
BRANCH="main"

cd "$APP_DIR" || exit 1

# Prevent simultaneous runs
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
touch "$LOCK_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fetch latest from GitHub (quietly)
git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/$BRANCH 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ] && [ -n "$REMOTE" ]; then
    log "======================================"
    log "NEW COMMIT DETECTED!"
    log "Local:  $LOCAL"
    log "Remote: $REMOTE"
    log "======================================"

    # Step 1: Reset to GitHub source of truth, then pull
    log "[1/5] Resetting local changes and pulling from origin/$BRANCH..."
    git reset --hard HEAD >> "$LOG_FILE" 2>&1
    git clean -fd >> "$LOG_FILE" 2>&1
    git pull origin "$BRANCH" >> "$LOG_FILE" 2>&1 || { log "ERROR: git pull failed"; rm -f "$LOCK_FILE"; exit 1; }

    # Step 2: Install dependencies
    log "[2/5] npm install..."
    npm install >> "$LOG_FILE" 2>&1 || { log "ERROR: npm install failed"; rm -f "$LOCK_FILE"; exit 1; }

    # Step 3: Build
    log "[3/5] npm run build..."
    npm run build >> "$LOG_FILE" 2>&1 || { log "ERROR: npm run build failed"; rm -f "$LOCK_FILE"; exit 1; }

    # Step 4: Restart services
    log "[4/5] Restarting PM2..."
    pm2 restart tashira --update-env >> "$LOG_FILE" 2>&1 || {
        log "PM2 not found, restarting nginx..."
        systemctl restart nginx >> "$LOG_FILE" 2>&1
    }

    # Step 5: Verify
    log "[5/5] Deployment complete!"
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "unavailable")
    log "Health check: $HEALTH"
    log "======================================"
fi

rm -f "$LOCK_FILE"
