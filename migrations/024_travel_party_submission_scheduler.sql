CREATE TABLE IF NOT EXISTS `travel_groups` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `travel_group_reference` varchar(100) NOT NULL,
  `arrangement` enum('TOGETHER','SEPARATELY') NOT NULL,
  `primary_traveller_id` bigint unsigned NOT NULL,
  `accompanying_adult_id` bigint unsigned NULL,
  `origin` varchar(100) NOT NULL,
  `destination` varchar(100) NOT NULL,
  `planned_arrival_date` date NOT NULL,
  `planned_departure_date` date NULL,
  `ticket_status` enum('NOT_BOOKED','RESERVED','CONFIRMED') NOT NULL DEFAULT 'NOT_BOOKED',
  `version` int unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `travel_group_application_reference_uq` (`application_id`,`travel_group_reference`),
  CONSTRAINT `travel_group_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_group_primary_fk` FOREIGN KEY (`primary_traveller_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_group_accompanying_fk` FOREIGN KEY (`accompanying_adult_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_group_dates_ck` CHECK (`planned_departure_date` IS NULL OR `planned_departure_date` >= `planned_arrival_date`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `travel_group_applicants` (
  `travel_group_id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `role` enum('PRIMARY_TRAVELLER','ACCOMPANYING_ADULT','TRAVELLER') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`travel_group_id`,`applicant_id`),
  KEY `travel_group_applicant_owner_idx` (`application_id`,`applicant_id`),
  CONSTRAINT `travel_group_applicant_group_fk` FOREIGN KEY (`travel_group_id`) REFERENCES `travel_groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_group_applicant_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_group_applicant_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `travel_document_applicant_links` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `document_type` enum('OUTBOUND_TICKET','RETURN_TICKET','ONWARD_TICKET','ROUND_TRIP_TICKET','FAMILY_BOOKING') NOT NULL,
  `linked_at` datetime NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `travel_document_applicant_uq` (`document_id`,`applicant_id`),
  KEY `travel_document_owner_idx` (`application_id`,`applicant_id`),
  CONSTRAINT `travel_document_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_document_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `submission_schedule_snapshots` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `travel_group_id` varchar(36) NOT NULL,
  `route_code` varchar(100) NOT NULL,
  `planned_arrival_date` date NOT NULL,
  `earliest_safe_submission_date` date NULL,
  `target_submission_date` date NULL,
  `latest_safe_submission_date` date NULL,
  `schedule_state` enum('SCHEDULED_FOR_SUBMISSION','READY_FOR_SUBMISSION','BLOCKED','HUMAN_REVIEW_REQUIRED') NOT NULL,
  `reason` varchar(500) NOT NULL,
  `blocking_reasons_json` json NOT NULL,
  `rule_versions_json` json NOT NULL,
  `evaluator_version` varchar(100) NOT NULL,
  `evidence_sha256` char(64) NOT NULL,
  `evaluated_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `submission_schedule_group_current_idx` (`travel_group_id`,`evaluated_at`,`id`),
  CONSTRAINT `submission_schedule_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `submission_schedule_travel_group_fk` FOREIGN KEY (`travel_group_id`) REFERENCES `travel_groups` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `travel_document_links_no_update` BEFORE UPDATE ON `travel_document_applicant_links` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Travel document links are append-only'; END$$
CREATE TRIGGER `travel_document_links_no_delete` BEFORE DELETE ON `travel_document_applicant_links` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Travel document links are append-only'; END$$
CREATE TRIGGER `submission_schedule_no_update` BEFORE UPDATE ON `submission_schedule_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submission schedule snapshots are append-only'; END$$
CREATE TRIGGER `submission_schedule_no_delete` BEFORE DELETE ON `submission_schedule_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submission schedule snapshots are append-only'; END$$
DELIMITER ;
