-- Fix invoices table to match code schema

-- Add missing columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT '5.00' NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(255);

-- Rename pdf_url to pdf_path if exists and pdf_path is empty
-- (Keep both for backward compatibility)

-- Drop status column (not in code) or keep it
-- ALTER TABLE invoices DROP COLUMN status;

-- Show final structure
DESCRIBE invoices;
