CREATE TABLE IF NOT EXISTS `travel_date_change_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `travel_group_id` varchar(36) NOT NULL,
  `previous_schedule_evaluation_id` varchar(36) NOT NULL,
  `new_schedule_evaluation_id` varchar(36) NOT NULL,
  `previous_arrival_date` date NOT NULL,
  `new_arrival_date` date NOT NULL,
  `version_before` int unsigned NOT NULL,
  `version_after` int unsigned NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `evidence_sha256` char(64) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `travel_date_change_application_idempotency_uq` (`application_id`,`idempotency_key`),
  KEY `travel_date_change_group_history_idx` (`travel_group_id`,`version_after`,`occurred_at`),
  CONSTRAINT `travel_date_change_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_date_change_group_fk` FOREIGN KEY (`travel_group_id`) REFERENCES `travel_groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_date_change_previous_schedule_fk` FOREIGN KEY (`previous_schedule_evaluation_id`) REFERENCES `submission_schedule_snapshots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_date_change_new_schedule_fk` FOREIGN KEY (`new_schedule_evaluation_id`) REFERENCES `submission_schedule_snapshots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `travel_date_change_version_ck` CHECK (`version_after` = `version_before` + 1),
  CONSTRAINT `travel_date_change_dates_ck` CHECK (`new_arrival_date` <> `previous_arrival_date`)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `travel_date_change_events_no_update` BEFORE UPDATE ON `travel_date_change_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Travel date change evidence is append-only'; END$$
CREATE TRIGGER `travel_date_change_events_no_delete` BEFORE DELETE ON `travel_date_change_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Travel date change evidence is append-only'; END$$
DELIMITER ;
