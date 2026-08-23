-- Purpose: persist controlled Operations commands with optimistic concurrency,
-- idempotency, append-only business history, and existing operations audit evidence.
-- Existing applications require no backfill; control rows are created lazily by the approved service.

CREATE TABLE IF NOT EXISTS `operations_case_controls` (
  `application_id` bigint unsigned NOT NULL,
  `version` bigint unsigned NOT NULL DEFAULT 0,
  `assigned_staff_user_id` bigint unsigned NULL,
  `team_id` bigint unsigned NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`application_id`),
  KEY `operations_case_assignment_idx` (`team_id`,`assigned_staff_user_id`),
  CONSTRAINT `operations_case_control_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_case_control_staff_fk` FOREIGN KEY (`assigned_staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_case_control_team_fk` FOREIGN KEY (`team_id`) REFERENCES `operations_teams` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_action_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `action_type` enum('HUMAN_REVIEW','DOCUMENT_REVIEW','ASSIGN','CLAIM','REASSIGN','STATUS_TRANSITION','REEVALUATION_REQUEST') NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `applicant_id` bigint unsigned NULL,
  `document_id` bigint unsigned NULL,
  `document_version` bigint unsigned NULL,
  `outcome` varchar(80) NULL,
  `from_state` varchar(50) NULL,
  `to_state` varchar(50) NULL,
  `previous_assignee_reference` varchar(100) NULL,
  `new_assignee_reference` varchar(100) NULL,
  `previous_evaluation_id` varchar(36) NULL,
  `new_evaluation_id` varchar(36) NULL,
  `reason` varchar(500) NOT NULL,
  `entity_version_before` bigint unsigned NOT NULL,
  `entity_version_after` bigint unsigned NOT NULL,
  `correlation_id` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `operations_action_application_idx` (`application_id`,`created_at`,`id`),
  KEY `operations_action_applicant_idx` (`applicant_id`,`created_at`),
  KEY `operations_action_document_idx` (`document_id`,`document_version`,`created_at`),
  KEY `operations_action_correlation_idx` (`correlation_id`),
  CONSTRAINT `operations_action_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_action_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_action_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_action_previous_evaluation_fk` FOREIGN KEY (`previous_evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_action_new_evaluation_fk` FOREIGN KEY (`new_evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_action_version_ck` CHECK (`entity_version_after` = `entity_version_before` + 1),
  CONSTRAINT `operations_action_document_owner_ck` CHECK (`document_id` IS NULL OR `applicant_id` IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_idempotency_records` (
  `application_id` bigint unsigned NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `command_hash` char(64) NOT NULL,
  `action_event_id` varchar(36) NOT NULL,
  `result_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`application_id`,`idempotency_key`),
  UNIQUE KEY `operations_idempotency_event_uq` (`action_event_id`),
  CONSTRAINT `operations_idempotency_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_idempotency_event_fk` FOREIGN KEY (`action_event_id`) REFERENCES `operations_action_events` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `operations_action_events_no_update` BEFORE UPDATE ON `operations_action_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations action history is append-only'; END$$
CREATE TRIGGER `operations_action_events_no_delete` BEFORE DELETE ON `operations_action_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations action history is append-only'; END$$
CREATE TRIGGER `operations_idempotency_no_update` BEFORE UPDATE ON `operations_idempotency_records` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations idempotency evidence is append-only'; END$$
CREATE TRIGGER `operations_idempotency_no_delete` BEFORE DELETE ON `operations_idempotency_records` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations idempotency evidence is append-only'; END$$
DELIMITER ;
