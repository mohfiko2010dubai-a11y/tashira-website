#!/bin/bash
# ============================================
# Manual Deploy - Run this on your server
# when you want to force an update NOW
# ============================================

echo "=========================================="
echo "  Tashira Manual Deploy"
echo "=========================================="
echo ""

cd /var/www/tashira || exit 1

echo "[1/4] Pulling latest changes from GitHub..."
git pull origin main

echo "[2/4] Installing dependencies..."
npm install

echo "[3/4] Building..."
npm run build

echo "[4/4] Restarting nginx..."
systemctl restart nginx

echo ""
echo "=========================================="
echo "  Deploy Complete!"
echo "=========================================="
echo "Check your website: http://tashiraev.com"
