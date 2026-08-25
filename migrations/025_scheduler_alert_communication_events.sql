CREATE TABLE IF NOT EXISTS `submission_scheduler_alert_events` (
  `id` varchar(36) NOT NULL,
  `alert_key` varchar(255) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `travel_group_id` varchar(36) NOT NULL,
  `schedule_evaluation_id` varchar(36) NOT NULL,
  `alert_type` enum('WINDOW_OPEN','DUE_SOON','URGENT','OVERDUE','BLOCKED') NOT NULL,
  `alert_state` enum('CREATED','ACKNOWLEDGED','RESOLVED') NOT NULL,
  `version` int unsigned NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scheduler_alert_version_uq` (`alert_key`,`version`),
  KEY `scheduler_alert_case_state_idx` (`application_id`,`alert_state`,`occurred_at`),
  CONSTRAINT `scheduler_alert_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `scheduler_alert_travel_group_fk` FOREIGN KEY (`travel_group_id`) REFERENCES `travel_groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `scheduler_alert_schedule_fk` FOREIGN KEY (`schedule_evaluation_id`) REFERENCES `submission_schedule_snapshots` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `scheduler_communication_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `travel_group_id` varchar(36) NOT NULL,
  `schedule_evaluation_id` varchar(36) NOT NULL,
  `event_type` enum('APPLICATION_SCHEDULED_FOR_SUBMISSION','TRAVEL_DATE_CHANGED','SUBMISSION_DELAYED_BY_MISSING_DOCUMENT','APPLICATION_READY_FOR_SUBMISSION','SUBMISSION_COMPLETED') NOT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `customer_contract_json` json NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scheduler_communication_idempotency_uq` (`idempotency_key`),
  KEY `scheduler_communication_case_idx` (`application_id`,`occurred_at`),
  CONSTRAINT `scheduler_communication_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `scheduler_communication_group_fk` FOREIGN KEY (`travel_group_id`) REFERENCES `travel_groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `scheduler_communication_schedule_fk` FOREIGN KEY (`schedule_evaluation_id`) REFERENCES `submission_schedule_snapshots` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `scheduler_alert_events_no_update` BEFORE UPDATE ON `submission_scheduler_alert_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduler alert events are append-only'; END$$
CREATE TRIGGER `scheduler_alert_events_no_delete` BEFORE DELETE ON `submission_scheduler_alert_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduler alert events are append-only'; END$$
CREATE TRIGGER `scheduler_communication_no_update` BEFORE UPDATE ON `scheduler_communication_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduler communication events are append-only'; END$$
CREATE TRIGGER `scheduler_communication_no_delete` BEFORE DELETE ON `scheduler_communication_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduler communication events are append-only'; END$$
DELIMITER ;
