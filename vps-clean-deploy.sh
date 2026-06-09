#!/bin/bash
set -e
echo "🧹 Clean deploy for TASHIRA..."

cd /var/www/tashira

echo "📥 Pull latest code..."
git pull

echo "🗑️ Clean old builds..."
rm -rf dist node_modules .cache

echo "📦 Fresh install..."
npm install

echo "🔨 Build..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "🗄️ Ensure documents table exists..."
mysql -u root tashira_db -e "
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  applicant_id BIGINT UNSIGNED,
  document_type ENUM('passport','photo','national_id','supporting','visa','invoice','gcc_residence','sponsor_id') NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  storage_provider VARCHAR(50) DEFAULT 'supabase' NOT NULL,
  storage_bucket VARCHAR(100) DEFAULT 'tashira-documents' NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  upload_status ENUM('pending','uploaded','failed','replaced') DEFAULT 'pending' NOT NULL,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB;
" 2>/dev/null || echo "⚠️ MySQL command failed, table may already exist"

echo "🔄 Restart server..."
pm2 delete tashira 2>/dev/null || true
pm2 start dist/boot.js --name tashira
pm2 save

echo "✅ Done!"
echo ""
echo "🔍 Check:"
echo "  pm2 status"
echo "  curl -s http://localhost:3000 | head -3"
