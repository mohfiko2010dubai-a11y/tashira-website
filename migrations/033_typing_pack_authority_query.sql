-- Provider-independent operational evidence only. This migration does not
-- connect to, submit to, or model credentials for any government authority.

CREATE TABLE IF NOT EXISTS `operations_typing_pack_templates` (
  `id` varchar(36) NOT NULL,
  `template_code` varchar(100) NOT NULL,
  `version` int unsigned NOT NULL,
  `lifecycle_state` enum('DRAFT','APPROVED','RETIRED') NOT NULL,
  `field_definitions_json` json NOT NULL,
  `source_reference` varchar(255) NOT NULL,
  `effective_from` datetime NOT NULL,
  `effective_to` datetime NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `typing_pack_template_version_uq` (`template_code`,`version`),
  KEY `typing_pack_template_lookup_idx` (`template_code`,`lifecycle_state`,`effective_from`,`effective_to`),
  CONSTRAINT `typing_pack_template_effective_ck` CHECK (`effective_to` IS NULL OR `effective_to` > `effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_typing_packs` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `evaluation_id` varchar(36) NOT NULL,
  `template_id` varchar(36) NOT NULL,
  `template_snapshot_json` json NOT NULL,
  `fields_json` json NOT NULL,
  `evidence_references_json` json NOT NULL,
  `state` enum('DRAFT_REQUIRES_HUMAN_REVIEW','APPROVED_FOR_EXPORT','RETIRED') NOT NULL,
  `integrity_sha256` char(64) NOT NULL,
  `generated_by` varchar(100) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `generated_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `typing_pack_idempotency_uq` (`application_id`,`idempotency_key`),
  KEY `typing_pack_application_history_idx` (`application_id`,`applicant_id`,`generated_at`),
  CONSTRAINT `typing_pack_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `typing_pack_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `typing_pack_evaluation_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `typing_pack_template_fk` FOREIGN KEY (`template_id`) REFERENCES `operations_typing_pack_templates` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_authority_queries` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NULL,
  `authority_code` varchar(100) NOT NULL,
  `query_type` varchar(100) NOT NULL,
  `current_state` enum('DRAFT','SUBMITTED','AWAITING_RESPONSE','RESPONSE_RECEIVED','CLOSED') NOT NULL,
  `version` bigint unsigned NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `authority_query_case_idx` (`application_id`,`applicant_id`,`current_state`,`created_at`),
  CONSTRAINT `authority_query_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `authority_query_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_authority_query_events` (
  `id` varchar(36) NOT NULL,
  `query_id` varchar(36) NOT NULL,
  `state` enum('DRAFT','SUBMITTED','AWAITING_RESPONSE','RESPONSE_RECEIVED','CLOSED') NOT NULL,
  `version_before` bigint unsigned NOT NULL,
  `version_after` bigint unsigned NOT NULL,
  `actor_type` enum('STAFF','SYSTEM') NOT NULL,
  `actor_reference` varchar(100) NULL,
  `reason` varchar(1000) NOT NULL,
  `external_reference` varchar(255) NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `authority_query_event_idempotency_uq` (`query_id`,`idempotency_key`),
  KEY `authority_query_event_history_idx` (`query_id`,`version_after`,`occurred_at`),
  CONSTRAINT `authority_query_event_query_fk` FOREIGN KEY (`query_id`) REFERENCES `operations_authority_queries` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `authority_query_event_version_ck` CHECK (`version_after` = `version_before` + 1)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `typing_pack_template_no_update` BEFORE UPDATE ON `operations_typing_pack_templates` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Typing Pack templates are immutable; create a new version'; END$$
CREATE TRIGGER `typing_pack_template_no_delete` BEFORE DELETE ON `operations_typing_pack_templates` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Typing Pack template evidence is append-only'; END$$
CREATE TRIGGER `typing_pack_ownership_guard` BEFORE INSERT ON `operations_typing_packs` FOR EACH ROW BEGIN IF NOT EXISTS (SELECT 1 FROM `applicants` WHERE `id`=NEW.applicant_id AND `application_id`=NEW.application_id) OR NOT EXISTS (SELECT 1 FROM `visa_rule_evaluation_runs` WHERE `id`=NEW.evaluation_id AND `application_id`=NEW.application_id AND `applicant_id`=NEW.applicant_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Typing Pack applicant/evaluation ownership mismatch'; END IF; END$$
CREATE TRIGGER `typing_pack_no_update` BEFORE UPDATE ON `operations_typing_packs` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Typing Pack evidence is immutable'; END$$
CREATE TRIGGER `typing_pack_no_delete` BEFORE DELETE ON `operations_typing_packs` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Typing Pack evidence is append-only'; END$$
CREATE TRIGGER `authority_query_ownership_guard` BEFORE INSERT ON `operations_authority_queries` FOR EACH ROW BEGIN IF NEW.applicant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `applicants` WHERE `id`=NEW.applicant_id AND `application_id`=NEW.application_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority Query applicant ownership mismatch'; END IF; END$$
CREATE TRIGGER `authority_query_identity_immutable` BEFORE UPDATE ON `operations_authority_queries` FOR EACH ROW BEGIN IF OLD.id <> NEW.id OR OLD.application_id <> NEW.application_id OR NOT (OLD.applicant_id <=> NEW.applicant_id) OR OLD.authority_code <> NEW.authority_code OR OLD.query_type <> NEW.query_type OR OLD.created_by <> NEW.created_by OR OLD.created_at <> NEW.created_at THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority Query identity is immutable'; END IF; END$$
CREATE TRIGGER `authority_query_no_delete` BEFORE DELETE ON `operations_authority_queries` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority Query evidence cannot be deleted'; END$$
CREATE TRIGGER `authority_query_event_no_update` BEFORE UPDATE ON `operations_authority_query_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority Query events are append-only'; END$$
CREATE TRIGGER `authority_query_event_no_delete` BEFORE DELETE ON `operations_authority_query_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority Query events are append-only'; END$$
DELIMITER ;
