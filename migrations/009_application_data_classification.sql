-- Classify historical test applications without deleting immutable evidence.
-- Existing and newly created applications remain LIVE unless explicitly marked TEST
-- by a separately authorized, audited production operation.
ALTER TABLE `applications`
  ADD COLUMN `data_classification` enum('LIVE','TEST') NOT NULL DEFAULT 'LIVE' AFTER `invoice_pdf_url`,
  ADD INDEX `applications_classification_created_idx` (`data_classification`, `created_at`);
