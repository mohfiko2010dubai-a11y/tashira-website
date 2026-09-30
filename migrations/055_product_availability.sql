CREATE TABLE IF NOT EXISTS visa_product_availability (
  service_code VARCHAR(80) PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at DATETIME(3) NULL,
  verification_source VARCHAR(1000) NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS visa_product_availability_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  service_code VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL,
  last_verified_at DATETIME(3) NULL,
  verification_source VARCHAR(1000) NULL,
  actor VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
INSERT IGNORE INTO visa_product_availability (service_code,is_active) VALUES
('14days-single',TRUE),('14days-multiple',TRUE),('30days-single',TRUE),('30days-multiple',TRUE),
('60days-single',TRUE),('60days-multiple',TRUE),('90days-single',FALSE),('96hours-transit',TRUE);
