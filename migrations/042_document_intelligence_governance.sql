CREATE TABLE IF NOT EXISTS `authority_application_field_requirements` (
  `id` varchar(36) NOT NULL,
  `authority_code` varchar(100) NOT NULL,
  `visa_route_code` varchar(100) NOT NULL,
  `field_code` varchar(128) NOT NULL,
  `field_label` varchar(200) NOT NULL,
  `requirement_kind` enum('REQUIRED','CONDITIONAL') NOT NULL,
  `nationality_scopes_json` json NOT NULL,
  `residence_scopes_json` json NOT NULL,
  `family_minor_scope` varchar(100) NULL,
  `travel_party_scope` varchar(100) NULL,
  `preferred_sources_json` json NOT NULL,
  `fallback_sources_json` json NOT NULL,
  `validation_rule` varchar(500) NOT NULL,
  `effective_from` datetime NOT NULL,
  `effective_to` datetime NULL,
  `source_evidence_json` json NOT NULL,
  `rule_version_id` varchar(36) NOT NULL,
  `approval_state` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','SUPERSEDED','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `staging_test_only` boolean NOT NULL DEFAULT false,
  `created_by` varchar(100) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `authority_field_requirement_version_uq` (`authority_code`,`visa_route_code`,`field_code`,`rule_version_id`),
  KEY `authority_field_requirement_route_idx` (`visa_route_code`,`approval_state`,`effective_from`),
  CONSTRAINT `authority_field_requirement_rule_version_fk` FOREIGN KEY (`rule_version_id`) REFERENCES `visa_rule_versions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `passport_profile_versions` (
  `id` varchar(36) NOT NULL,
  `profile_code` varchar(128) NOT NULL,
  `version` int unsigned NOT NULL,
  `issuing_country` varchar(3) NOT NULL,
  `passport_type` varchar(30) NOT NULL,
  `layout_version` varchar(100) NOT NULL,
  `profile_json` json NOT NULL,
  `profile_sha256` varchar(64) NOT NULL,
  `confidence_threshold` decimal(5,4) NOT NULL,
  `effective_from` datetime NOT NULL,
  `effective_to` datetime NULL,
  `source_evidence_json` json NOT NULL,
  `approval_state` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','SUPERSEDED','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `staging_test_only` boolean NOT NULL DEFAULT false,
  `created_by` varchar(100) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `passport_profile_version_uq` (`profile_code`,`version`),
  KEY `passport_profile_lookup_idx` (`issuing_country`,`passport_type`,`approval_state`,`effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `document_intelligence_governance_events` (
  `id` varchar(36) NOT NULL,
  `entity_type` enum('AUTHORITY_FIELD_REQUIREMENT','PASSPORT_PROFILE') NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `from_status` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','SUPERSEDED','RETIRED') NULL,
  `to_status` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','SUPERSEDED','RETIRED') NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `payload_sha256` varchar(64) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `document_intelligence_governance_history_idx` (`entity_type`,`entity_id`,`occurred_at`,`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `document_intelligence_runs` (
  `id` varchar(36) NOT NULL,
  `request_key` varchar(100) NOT NULL,
  `request_sha256` varchar(64) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `passport_profile_id` varchar(36) NULL,
  `provider` varchar(100) NOT NULL,
  `model_version` varchar(100) NOT NULL,
  `processing_tier` enum('DETERMINISTIC','MRZ','LOW_COST_OCR','PROFILE_MAPPING','ADVANCED_AI','HUMAN_REVIEW') NOT NULL,
  `processing_tiers_json` json NOT NULL,
  `page_count` int unsigned NOT NULL,
  `call_count` int unsigned NOT NULL,
  `processing_cost` decimal(12,6) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `escalation_reasons_json` json NOT NULL,
  `warnings_json` json NOT NULL,
  `result_sha256` varchar(64) NOT NULL,
  `processed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_intelligence_run_request_uq` (`application_id`,`request_key`),
  KEY `document_intelligence_run_owner_idx` (`application_id`,`applicant_id`,`document_id`,`processed_at`),
  CONSTRAINT `document_intelligence_run_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_intelligence_run_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_intelligence_run_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_intelligence_run_profile_fk` FOREIGN KEY (`passport_profile_id`) REFERENCES `passport_profile_versions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `document_field_evidence` (
  `id` varchar(36) NOT NULL,
  `run_id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NULL,
  `field_code` varchar(128) NOT NULL,
  `raw_value_reference` varchar(255) NOT NULL,
  `extracted_value` text NOT NULL,
  `normalized_value` text NOT NULL,
  `source_type` enum('PASSPORT_MRZ','PASSPORT_VISUAL','NATIONAL_ID','RESIDENCE_DOCUMENT','TICKET','CUSTOMER_DECLARED','STAFF_VERIFIED','AUTHORITY_RESPONSE') NOT NULL,
  `confidence` decimal(5,4) NOT NULL,
  `customer_confirmed` boolean NOT NULL DEFAULT false,
  `staff_verified` boolean NOT NULL DEFAULT false,
  `verified_at` datetime(3) NULL,
  `verification_state` enum('DECLARED','EXTRACTED','CONFIRMED','VERIFIED','CONFLICTED') NOT NULL,
  `extracted_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `document_field_evidence_owner_idx` (`application_id`,`applicant_id`,`field_code`,`extracted_at`),
  CONSTRAINT `document_field_evidence_run_fk` FOREIGN KEY (`run_id`) REFERENCES `document_intelligence_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_field_evidence_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_field_evidence_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_field_evidence_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `applicant_field_selection_events` (
  `id` varchar(36) NOT NULL,
  `run_id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `field_requirement_id` varchar(36) NOT NULL,
  `field_code` varchar(128) NOT NULL,
  `selected_evidence_id` varchar(36) NULL,
  `field_state` enum('DECLARED','EXTRACTED','CONFIRMED','VERIFIED','CONFLICTED','MISSING') NOT NULL,
  `reason` varchar(500) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `evidence_integrity_sha256` varchar(64) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `applicant_field_selection_run_idx` (`run_id`,`occurred_at`,`id`),
  KEY `applicant_field_selection_history_idx` (`application_id`,`applicant_id`,`field_code`,`occurred_at`,`id`),
  CONSTRAINT `applicant_field_selection_run_fk` FOREIGN KEY (`run_id`) REFERENCES `document_intelligence_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_field_selection_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_field_selection_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_field_selection_requirement_fk` FOREIGN KEY (`field_requirement_id`) REFERENCES `authority_application_field_requirements` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_field_selection_evidence_fk` FOREIGN KEY (`selected_evidence_id`) REFERENCES `document_field_evidence` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `authority_field_requirement_no_update` BEFORE UPDATE ON `authority_application_field_requirements`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Authority field requirement versions are immutable'$$
CREATE TRIGGER `authority_field_requirement_no_delete` BEFORE DELETE ON `authority_application_field_requirements`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Authority field requirement versions are immutable'$$
CREATE TRIGGER `passport_profile_version_no_update` BEFORE UPDATE ON `passport_profile_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Passport profile versions are immutable'$$
CREATE TRIGGER `passport_profile_version_no_delete` BEFORE DELETE ON `passport_profile_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Passport profile versions are immutable'$$
CREATE TRIGGER `document_intelligence_governance_no_update` BEFORE UPDATE ON `document_intelligence_governance_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document intelligence governance is append-only'$$
CREATE TRIGGER `document_intelligence_governance_no_delete` BEFORE DELETE ON `document_intelligence_governance_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document intelligence governance is append-only'$$
CREATE TRIGGER `document_intelligence_run_no_update` BEFORE UPDATE ON `document_intelligence_runs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document intelligence runs are immutable'$$
CREATE TRIGGER `document_intelligence_run_no_delete` BEFORE DELETE ON `document_intelligence_runs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document intelligence runs are immutable'$$
CREATE TRIGGER `document_field_evidence_no_update` BEFORE UPDATE ON `document_field_evidence`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document field evidence is immutable'$$
CREATE TRIGGER `document_field_evidence_no_delete` BEFORE DELETE ON `document_field_evidence`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document field evidence is immutable'$$
CREATE TRIGGER `applicant_field_selection_no_update` BEFORE UPDATE ON `applicant_field_selection_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Applicant field selection history is append-only'$$
CREATE TRIGGER `applicant_field_selection_no_delete` BEFORE DELETE ON `applicant_field_selection_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Applicant field selection history is append-only'$$
DELIMITER ;
