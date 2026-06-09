#!/bin/bash
set -e
echo "🚀 Deploying TASHIRA Document Upload System..."
cd /var/www/tashira
echo "📥 Pulling code..."
git pull
echo "📦 Installing dependencies..."
npm install
echo "🔨 Building..."
npm run build
echo "🔄 Restarting server..."
pm2 restart tashira
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verify:"
echo "  - pm2 status"
echo "  - mysql -u root tashira_db -e 'DESCRIBE documents;'"
echo "  - curl -s http://localhost:3000/api/health 2>/dev/null || echo 'Health check not configured'"
