-- Immutable visa-document safety evidence and customer delivery packages.
-- This migration does not scan files and does not expose storage locations.

CREATE TABLE IF NOT EXISTS `operations_document_security_scans` (
  `id` varchar(36) NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `provider_code` varchar(100) NOT NULL,
  `provider_reference` varchar(255) NULL,
  `engine_version` varchar(100) NOT NULL,
  `result` enum('PASSED','FAILED','ERROR') NOT NULL,
  `evidence_sha256` char(64) NOT NULL,
  `scanned_at` datetime NOT NULL,
  `recorded_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_security_scan_provider_uq` (`provider_code`,`provider_reference`),
  KEY `document_security_scan_current_idx` (`document_id`,`scanned_at`,`created_at`),
  CONSTRAINT `document_security_scan_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_security_scan_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_security_scan_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_visa_deliveries` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `visa_document_id` bigint unsigned NOT NULL,
  `security_scan_id` varchar(36) NOT NULL,
  `recipient_reference` varchar(100) NOT NULL,
  `visa_reference` varchar(100) NOT NULL,
  `validity_summary` varchar(500) NOT NULL,
  `customer_instructions_json` json NOT NULL,
  `evidence_references_json` json NOT NULL,
  `state` enum('READY_FOR_SECURE_DELIVERY') NOT NULL,
  `integrity_sha256` char(64) NOT NULL,
  `prepared_by` varchar(100) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `prepared_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visa_delivery_idempotency_uq` (`application_id`,`idempotency_key`),
  UNIQUE KEY `visa_delivery_document_uq` (`visa_document_id`),
  KEY `visa_delivery_customer_idx` (`application_id`,`applicant_id`,`prepared_at`),
  CONSTRAINT `visa_delivery_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_delivery_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_delivery_document_fk` FOREIGN KEY (`visa_document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_delivery_scan_fk` FOREIGN KEY (`security_scan_id`) REFERENCES `operations_document_security_scans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `document_security_scan_ownership_guard` BEFORE INSERT ON `operations_document_security_scans` FOR EACH ROW BEGIN DECLARE owned_count bigint DEFAULT 0; SELECT COUNT(*) INTO owned_count FROM documents d JOIN applicants ap ON ap.id=NEW.applicant_id AND ap.application_id=NEW.application_id WHERE d.id=NEW.document_id AND d.application_id=NEW.application_id AND d.applicant_id=NEW.applicant_id AND d.document_type='visa' AND d.upload_status='uploaded'; IF owned_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa scan ownership evidence invalid'; END IF; END$$
CREATE TRIGGER `document_security_scan_no_update` BEFORE UPDATE ON `operations_document_security_scans` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document security scan evidence is immutable'; END$$
CREATE TRIGGER `document_security_scan_no_delete` BEFORE DELETE ON `operations_document_security_scans` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document security scan evidence is immutable'; END$$
CREATE TRIGGER `visa_delivery_ownership_guard` BEFORE INSERT ON `operations_visa_deliveries` FOR EACH ROW BEGIN DECLARE evidence_count bigint DEFAULT 0; SELECT COUNT(*) INTO evidence_count FROM documents d JOIN applicants ap ON ap.id=NEW.applicant_id AND ap.application_id=NEW.application_id JOIN operations_document_security_scans s ON s.id=NEW.security_scan_id AND s.document_id=d.id AND s.application_id=NEW.application_id AND s.applicant_id=NEW.applicant_id AND s.result='PASSED' WHERE d.id=NEW.visa_document_id AND d.application_id=NEW.application_id AND d.applicant_id=NEW.applicant_id AND d.document_type='visa' AND d.upload_status='uploaded'; IF evidence_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa delivery ownership or scan evidence invalid'; END IF; END$$
CREATE TRIGGER `visa_delivery_no_update` BEFORE UPDATE ON `operations_visa_deliveries` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa delivery evidence is immutable'; END$$
CREATE TRIGGER `visa_delivery_no_delete` BEFORE DELETE ON `operations_visa_deliveries` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa delivery evidence is immutable'; END$$
DELIMITER ;
