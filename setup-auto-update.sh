#!/bin/bash
# ============================================
# One-time setup for auto-update
# Run this ONCE on your server
# ============================================

echo "=========================================="
echo "  Tashira Auto-Update Setup"
echo "=========================================="
echo ""

REPO_DIR="/var/www/tashira"
UPDATE_SCRIPT="$REPO_DIR/auto-update.sh"

# 1. Make script executable
chmod +x "$UPDATE_SCRIPT"

# 2. Add to crontab (run every minute)
echo "Setting up cron job (every minute)..."
(crontab -l 2>/dev/null | grep -v "tashira-update"; echo "* * * * * $UPDATE_SCRIPT >> /var/log/tashira-cron.log 2>&1") | crontab -

# 3. Create log file
touch /var/log/tashira-updates.log
touch /var/log/tashira-cron.log

# 4. Test the script
echo "Testing auto-update script..."
bash "$UPDATE_SCRIPT"

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Your server will now check for updates"
echo "every minute from GitHub."
echo ""
echo "To check update logs:"
echo "  tail -f /var/log/tashira-updates.log"
echo ""
echo "To check cron logs:"
echo "  tail -f /var/log/tashira-cron.log"
echo ""
