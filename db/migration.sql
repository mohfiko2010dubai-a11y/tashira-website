-- Run this on the VPS MySQL to add missing columns
-- mysql -u tashira_user -p'Tashira2025Secure' tashira_db < migration.sql

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT UNSIGNED NULL AFTER total_amount,
  ADD COLUMN IF NOT EXISTS supplier_cost DECIMAL(10,2) NULL AFTER supplier_id;

-- Create suppliers table if not exists
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(320),
  phone VARCHAR(50),
  notes TEXT,
  is_active ENUM('active','inactive') DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);
