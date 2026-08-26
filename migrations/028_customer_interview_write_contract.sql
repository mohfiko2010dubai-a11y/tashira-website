ALTER TABLE `applicants`
  ADD COLUMN `profile_version` int unsigned NOT NULL DEFAULT 1;

ALTER TABLE `family_relationship_events`
  MODIFY COLUMN `relationship_type` enum('LEAD_APPLICANT','SPOUSE','PARENT','CHILD','GUARDIAN','DEPENDENT','SIBLING','OTHER') NOT NULL;

CREATE TABLE IF NOT EXISTS `customer_interview_profile_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `profile_version` int unsigned NOT NULL,
  `event_type` enum('CREATED','UPDATED') NOT NULL,
  `profile_json` json NOT NULL,
  `reason` varchar(500) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `command_sha256` char(64) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_profile_applicant_version_uq` (`applicant_id`,`profile_version`),
  UNIQUE KEY `customer_profile_application_idempotency_uq` (`application_id`,`idempotency_key`),
  KEY `customer_profile_application_idx` (`application_id`,`applicant_id`,`occurred_at`,`id`),
  CONSTRAINT `customer_profile_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `customer_profile_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `customer_interview_command_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `command_type` enum('DEFINE_RELATIONSHIP','DEFINE_TRAVEL_GROUP','UPDATE_TRAVEL_GROUP','LINK_SHARED_DOCUMENT') NOT NULL,
  `entity_reference` varchar(100) NOT NULL,
  `entity_version` int unsigned NULL,
  `command_sha256` char(64) NOT NULL,
  `evidence_json` json NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_command_application_idempotency_uq` (`application_id`,`idempotency_key`),
  KEY `customer_command_entity_idx` (`application_id`,`command_type`,`entity_reference`,`occurred_at`,`id`),
  CONSTRAINT `customer_command_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `customer_profile_events_no_update` BEFORE UPDATE ON `customer_interview_profile_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer profile history is append-only'; END$$
CREATE TRIGGER `customer_profile_events_no_delete` BEFORE DELETE ON `customer_interview_profile_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer profile history is append-only'; END$$
CREATE TRIGGER `customer_command_events_no_update` BEFORE UPDATE ON `customer_interview_command_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer interview command history is append-only'; END$$
CREATE TRIGGER `customer_command_events_no_delete` BEFORE DELETE ON `customer_interview_command_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer interview command history is append-only'; END$$
DELIMITER ;
