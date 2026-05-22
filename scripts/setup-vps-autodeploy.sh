#!/bin/bash
# ============================================
# TASHIRA VPS AUTO-DEPLOYMENT SETUP
# One-time setup - Run this on your VPS
# ============================================

set -e

APP_DIR="/var/www/tashira"
SCRIPTS_DIR="$APP_DIR/scripts"
LOG_DIR="/var/log"
WEBHOOK_SECRET="tashira-webhook-secret-2026"
WEBHOOK_PORT=9000

echo ""
echo "============================================"
echo "  TASHIRA VPS AUTO-DEPLOYMENT SETUP"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Step 1: Install Python dependencies
echo "[1/7] Installing Python Flask..."
apt-get update -qq
apt-get install -y -qq python3-flask python3-pip curl
pip3 install flask --quiet 2>/dev/null || true

# Step 2: Make scripts executable
echo "[2/7] Setting up scripts..."
chmod +x "$SCRIPTS_DIR/webhook-server.py"
chmod +x "$SCRIPTS_DIR/cron-deploy.sh"
chmod +x "$SCRIPTS_DIR/manual-deploy.sh"
chmod +x "$APP_DIR/auto-update.sh"

# Step 3: Create log files
echo "[3/7] Creating log files..."
touch "$LOG_DIR/tashira-deploy.log"
touch "$LOG_DIR/tashira-cron-deploy.log"
touch "$LOG_DIR/tashira-webhook.log"
chmod 644 "$LOG_DIR"/tashira-*.log

# Step 4: Install systemd service for webhook
echo "[4/7] Installing webhook systemd service..."
cp "$SCRIPTS_DIR/tashira-webhook.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable tashira-webhook.service
systemctl start tashira-webhook.service

# Step 5: Setup cron fallback (checks every minute)
echo "[5/7] Setting up cron fallback (every minute)..."
(crontab -l 2>/dev/null | grep -v "tashira-cron-deploy"; echo "* * * * * $SCRIPTS_DIR/cron-deploy.sh >> $LOG_DIR/tashira-cron-deploy.log 2>&1") | crontab -

# Step 6: Open firewall port for webhook
echo "[6/7] Configuring firewall..."
ufw allow $WEBHOOK_PORT/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true

# Step 7: Verify webhook is running
echo "[7/7] Verifying webhook server..."
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEBHOOK_PORT/health 2>/dev/null || echo "failed")

echo ""
echo "============================================"
echo "  SETUP COMPLETE!"
echo "============================================"
echo ""
echo "Webhook server: http://YOUR_SERVER_IP:$WEBHOOK_PORT"
echo "Health check:   http://YOUR_SERVER_IP:$WEBHOOK_PORT/health"
echo "Deploy logs:    http://YOUR_SERVER_IP:$WEBHOOK_PORT/logs"
echo ""
echo "GitHub Webhook Configuration:"
echo "============================================"
echo "Payload URL:    http://YOUR_SERVER_IP:$WEBHOOK_PORT/deploy"
echo "Content type:   application/json"
echo "Secret:         $WEBHOOK_SECRET"
echo "Events:         Just the push event"
echo ""
echo "Services Status:"
echo "============================================"
echo "Webhook service: $(systemctl is-active tashira-webhook)"
echo "Cron job:        Active (every minute)"
echo ""
echo "Useful Commands:"
echo "  View webhook logs:   journalctl -u tashira-webhook -f"
echo "  View deploy logs:    tail -f $LOG_DIR/tashira-deploy.log"
echo "  Manual deploy:       bash $SCRIPTS_DIR/manual-deploy.sh"
echo "  Restart webhook:     systemctl restart tashira-webhook"
echo ""
echo "Next Steps:"
echo "1. Replace YOUR_SERVER_IP with your actual VPS IP (e.g. 168.231.85.149)"
echo "2. Go to https://github.com/YOUR_USER/tashira-website/settings/hooks"
echo "3. Add webhook with the URL and secret above"
echo "4. Push code from the sandbox → VPS auto-deploys in seconds!"
echo ""
