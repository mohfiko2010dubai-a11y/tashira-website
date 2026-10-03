CREATE TABLE IF NOT EXISTS financial_document_counters (
  series VARCHAR(12) NOT NULL,
  last_number BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (series)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS financial_document_archives (
  document_number VARCHAR(50) NOT NULL PRIMARY KEY,
  issuance_key VARCHAR(120) NOT NULL UNIQUE,
  application_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  series VARCHAR(12) NOT NULL,
  sequence_number BIGINT UNSIGNED NOT NULL,
  issued_at DATETIME(3) NOT NULL,
  snapshot_json LONGTEXT NOT NULL,
  pdf_bytes LONGBLOB NOT NULL,
  pdf_sha256 CHAR(64) NOT NULL,
  UNIQUE KEY financial_document_sequence (series, sequence_number),
  INDEX financial_document_application (application_id)
) ENGINE=InnoDB;

CREATE TRIGGER financial_document_no_update BEFORE UPDATE ON financial_document_archives
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued financial documents are immutable';
CREATE TRIGGER financial_document_no_delete BEFORE DELETE ON financial_document_archives
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued financial documents cannot be deleted';
