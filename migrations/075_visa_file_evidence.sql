CREATE TABLE IF NOT EXISTS operations_visa_file_evidence (
  scan_id varchar(36) NOT NULL,
  storage_path varchar(255) NOT NULL,
  content_sha256 char(64) NOT NULL,
  byte_length int unsigned NOT NULL,
  mime_type varchar(100) NOT NULL,
  engine_version varchar(100) NOT NULL,
  database_version varchar(100) NOT NULL,
  scanned_at datetime(3) NOT NULL,
  PRIMARY KEY (scan_id),
  UNIQUE KEY visa_file_snapshot_path_uq (storage_path),
  CONSTRAINT visa_file_scan_fk FOREIGN KEY (scan_id) REFERENCES operations_document_security_scans(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER visa_file_evidence_no_update BEFORE UPDATE ON operations_visa_file_evidence FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa file evidence is immutable'; END$$
CREATE TRIGGER visa_file_evidence_no_delete BEFORE DELETE ON operations_visa_file_evidence FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa file evidence is immutable'; END$$
DELIMITER ;
