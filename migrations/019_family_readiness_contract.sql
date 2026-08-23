CREATE TABLE IF NOT EXISTS `family_relationship_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `from_applicant_id` bigint unsigned NOT NULL,
  `to_applicant_id` bigint unsigned NOT NULL,
  `relationship_type` enum('LEAD_APPLICANT','SPOUSE','CHILD','PARENT','SIBLING','OTHER') NOT NULL,
  `event_type` enum('ESTABLISHED','REVOKED') NOT NULL,
  `reason` varchar(500) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `family_relationship_application_idx` (`application_id`,`occurred_at`,`id`),
  CONSTRAINT `family_relationship_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `family_relationship_from_applicant_fk` FOREIGN KEY (`from_applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `family_relationship_to_applicant_fk` FOREIGN KEY (`to_applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `applicant_requirement_instances` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `evaluation_id` varchar(36) NOT NULL,
  `catalog_version` varchar(100) NOT NULL,
  `requirement_code` varchar(100) NOT NULL,
  `requirement_kind` enum('DOCUMENT','QUESTION') NOT NULL,
  `critical` boolean NOT NULL,
  `conditional` boolean NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `applicant_requirement_evaluation_code_uq` (`evaluation_id`,`applicant_id`,`requirement_kind`,`requirement_code`),
  KEY `applicant_requirement_application_idx` (`application_id`,`applicant_id`,`created_at`),
  CONSTRAINT `applicant_requirement_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_requirement_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `applicant_requirement_evaluation_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `applicant_requirement_events` (
  `id` varchar(36) NOT NULL,
  `requirement_instance_id` varchar(36) NOT NULL,
  `state` enum('MISSING','UPLOADED','VALIDATED','WAIVED','CONDITIONAL_PENDING') NOT NULL,
  `reason` varchar(500) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `applicant_requirement_event_current_idx` (`requirement_instance_id`,`occurred_at`,`id`),
  CONSTRAINT `applicant_requirement_event_instance_fk` FOREIGN KEY (`requirement_instance_id`) REFERENCES `applicant_requirement_instances` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `family_readiness_snapshots` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `family_readiness_state` enum('READY_FOR_SUBMISSION','NOT_READY') NOT NULL,
  `member_states_json` json NOT NULL,
  `blocking_applicant_ids_json` json NOT NULL,
  `blocking_reasons_json` json NOT NULL,
  `required_customer_actions_json` json NOT NULL,
  `manual_review_required` boolean NOT NULL,
  `route_compatibility_warnings_json` json NOT NULL,
  `evaluator_version` varchar(100) NOT NULL,
  `evidence_sha256` char(64) NOT NULL,
  `evaluated_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `family_readiness_application_idx` (`application_id`,`evaluated_at`,`id`),
  CONSTRAINT `family_readiness_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `family_relationship_events_no_update` BEFORE UPDATE ON `family_relationship_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Family relationship history is append-only'; END$$
CREATE TRIGGER `family_relationship_events_no_delete` BEFORE DELETE ON `family_relationship_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Family relationship history is append-only'; END$$
CREATE TRIGGER `applicant_requirement_instances_no_update` BEFORE UPDATE ON `applicant_requirement_instances` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Applicant requirement instances are append-only'; END$$
CREATE TRIGGER `applicant_requirement_instances_no_delete` BEFORE DELETE ON `applicant_requirement_instances` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Applicant requirement instances are append-only'; END$$
CREATE TRIGGER `applicant_requirement_events_no_update` BEFORE UPDATE ON `applicant_requirement_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Applicant requirement events are append-only'; END$$
CREATE TRIGGER `applicant_requirement_events_no_delete` BEFORE DELETE ON `applicant_requirement_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Applicant requirement events are append-only'; END$$
CREATE TRIGGER `family_readiness_snapshots_no_update` BEFORE UPDATE ON `family_readiness_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Family readiness snapshots are append-only'; END$$
CREATE TRIGGER `family_readiness_snapshots_no_delete` BEFORE DELETE ON `family_readiness_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Family readiness snapshots are append-only'; END$$
DELIMITER ;
