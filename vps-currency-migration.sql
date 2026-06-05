-- Currency Migration Script for TASHIRA VPS
-- Run this AFTER git pull and build

-- Step 1: Add exchange_rate
ALTER TABLE applications ADD COLUMN exchange_rate DECIMAL(10,4) DEFAULT '3.6725';

-- Step 2: Add AED/USD amount columns
ALTER TABLE applications ADD COLUMN total_amount_aed DECIMAL(10,2) NOT NULL DEFAULT '0';
ALTER TABLE applications ADD COLUMN total_amount_usd DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN stripe_amount_usd DECIMAL(10,2) DEFAULT NULL;

-- Step 3: Add supplier detail columns
ALTER TABLE applications ADD COLUMN supplier_cost_aed DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_vat_status ENUM('standard','zero_rated','exempt','out_of_scope') DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_place_of_supply ENUM('within_uae','outside_uae') DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_vat_amount DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_total_aed DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_invoice_number VARCHAR(100) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN supplier_paid ENUM('pending','paid') DEFAULT 'pending';
ALTER TABLE applications ADD COLUMN supplier_notes TEXT DEFAULT NULL;

-- Step 4: Migrate old data (copy total_amount to total_amount_aed)
UPDATE applications SET total_amount_aed = total_amount WHERE total_amount_aed = 0 OR total_amount_aed IS NULL;

-- Step 5: Verify
DESCRIBE applications;
SELECT COUNT(*) as total_apps, 
       SUM(total_amount_aed) as total_aed,
       SUM(total_amount) as total_legacy
FROM applications;
