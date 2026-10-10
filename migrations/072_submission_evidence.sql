CREATE TABLE operations_submission_evidence (
  id char(36) NOT NULL PRIMARY KEY,
  application_id bigint unsigned NOT NULL,
  supplier_id bigint unsigned NOT NULL,
  evidence_kind enum('SUPPLIER_SENT','AUTHORITY_FILED') NOT NULL,
  external_reference varchar(100) NOT NULL,
  source_document_id bigint unsigned NOT NULL,
  document_id bigint unsigned NOT NULL,
  content_sha256 char(64) NOT NULL,
  service_code varchar(80) NOT NULL,
  applicant_quantity int unsigned NOT NULL,
  occurred_at datetime(3) NOT NULL,
  follow_up_at datetime(3) NULL,
  command_hash char(64) NOT NULL,
  recorded_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actor_reference varchar(100) NOT NULL,
  UNIQUE KEY submission_protected_document (document_id),
  KEY submission_application (application_id,recorded_at),
  CONSTRAINT submission_app_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT submission_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT submission_source_fk FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE RESTRICT,
  CONSTRAINT submission_copy_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER submission_evidence_no_update BEFORE UPDATE ON operations_submission_evidence FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submission evidence is immutable'; END$$
CREATE TRIGGER submission_evidence_no_delete BEFORE DELETE ON operations_submission_evidence FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submission evidence is immutable'; END$$
DELIMITER ;
