#!/bin/bash
# TASHIRA Document Upload System - VPS Deployment Script
# Run this on your VPS after configuring .env

echo "🚀 Starting deployment..."

cd /var/www/tashira

echo "📥 Step 1: Pull latest code..."
git pull

echo "📦 Step 2: Install Supabase package..."
npm install @supabase/supabase-js

echo "🗄️ Step 3: Push database schema..."
npm run db:push

echo "🔨 Step 4: Build..."
npm run build

echo "🔄 Step 5: Restart server..."
pm2 restart tashira

echo "✅ Deployment complete!"
echo ""
echo "📋 Verification commands:"
echo "  pm2 status"
echo "  mysql -u root tashira_db -e 'SHOW TABLES LIKE \"documents\";'"
echo "  cat /var/www/tashira/.env | grep SUPABASE"
