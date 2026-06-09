#!/bin/bash
echo "🚀 Deploying..."
cd /var/www/tashira && git pull && npm run build && pm2 restart tashira
echo "✅ Done! Check browser console for [collectPendingFiles] and [processFile] logs."
