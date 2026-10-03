ALTER TABLE business_settings_versions
  ADD COLUMN company_licence VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN company_website VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN company_logo TEXT NULL,
  ADD COLUMN provisional_fields_json TEXT NULL,
  ADD COLUMN passport_months INT NOT NULL DEFAULT 6,
  ADD COLUMN residence_months INT NOT NULL DEFAULT 3,
  ADD COLUMN child_under_years INT NOT NULL DEFAULT 12,
  MODIFY COLUMN settings_vat_rate DECIMAL(7,4) NULL;

-- Existing versions are immutable. Missing provisional evidence fails closed;
-- an administrator must issue a complete new version, never rewrite history.

ALTER TABLE applicants ADD COLUMN residence_expiry VARCHAR(20) NULL, ADD COLUMN date_of_birth VARCHAR(20) NULL;

ALTER TABLE invoices ADD COLUMN business_settings_version BIGINT UNSIGNED NULL;
