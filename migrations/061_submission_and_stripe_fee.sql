ALTER TABLE payments
  ADD COLUMN stripe_fee_minor BIGINT UNSIGNED NULL,
  ADD COLUMN stripe_fee_currency VARCHAR(3) NULL,
  ADD COLUMN stripe_balance_transaction_id VARCHAR(100) NULL;
ALTER TABLE applications
  ADD COLUMN submitted_product VARCHAR(80) NULL,
  ADD COLUMN submitted_reason VARCHAR(500) NULL,
  ADD COLUMN substitution_version INT NOT NULL DEFAULT 0,
  ADD COLUMN substitution_acknowledged_version INT NULL,
  ADD COLUMN substitution_acknowledged_at DATETIME(3) NULL;

CREATE TABLE product_substitution_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  version INT NOT NULL,
  product VARCHAR(80) NOT NULL,
  action VARCHAR(20) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  reason VARCHAR(500) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX substitution_application (application_id,version)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER application_substitution_filing_guard BEFORE UPDATE ON applications
FOR EACH ROW
BEGIN
  IF NEW.status IN ('visa_processing','visa_received','completed') THEN
    IF NEW.submitted_product IS NOT NULL AND NEW.submitted_product <> NEW.visa_type
      AND (NEW.substitution_acknowledged_version IS NULL OR NEW.substitution_acknowledged_version <> NEW.substitution_version) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer acknowledgement of the substituted product is required before filing';
    END IF;
    SET NEW.submitted_product = COALESCE(NEW.submitted_product, NEW.visa_type);
  END IF;
END$$
DELIMITER ;
