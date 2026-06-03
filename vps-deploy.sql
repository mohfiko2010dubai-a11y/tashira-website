-- ============================================================
-- TASHIRA VPS Deployment SQL Script
-- Run this on your Hostinger VPS MySQL database
-- ============================================================
-- Usage:
-- mysql -u tashira_user -p tashira_db < vps-deploy.sql
-- (enter password: Tashira2025Secure)
-- ============================================================

-- 1. Add supplier columns to applications table (if not exists)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'applications'
  AND COLUMN_NAME = 'supplier_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE applications ADD COLUMN supplier_id BIGINT UNSIGNED DEFAULT NULL',
  'SELECT "supplier_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'applications'
  AND COLUMN_NAME = 'supplier_cost'
);
SET @sql2 = IF(@col_exists2 = 0,
  'ALTER TABLE applications ADD COLUMN supplier_cost DECIMAL(10,2) DEFAULT NULL',
  'SELECT "supplier_cost already exists" AS message'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 2. Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(320),
  phone VARCHAR(50),
  notes TEXT,
  is_active ENUM('active', 'inactive') DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create staff_users table (for employee login)
CREATE TABLE IF NOT EXISTS staff_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(50),
  is_active ENUM('active', 'inactive') DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Show results
SELECT 'Deployment complete!' AS status;
SELECT 'Applications table columns:' AS info;
SHOW COLUMNS FROM applications;
SELECT 'Suppliers table created:' AS info;
SHOW COLUMNS FROM suppliers;
SELECT 'Staff users table created:' AS info;
SHOW COLUMNS FROM staff_users;
