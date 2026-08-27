-- Governed TASHIRA operational policy. This never changes OFFICIAL eligibility.
CREATE TABLE IF NOT EXISTS `operations_submission_policies` (
  `id` varchar(36) NOT NULL,
  `policy_code` varchar(100) NOT NULL,
  `version` int unsigned NOT NULL,
  `classification` enum('OPERATIONAL') NOT NULL DEFAULT 'OPERATIONAL',
  `lifecycle_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED') NOT NULL,
  `record_version` bigint unsigned NOT NULL DEFAULT 1,
  `thresholds_json` json NOT NULL,
  `source_reference` varchar(255) NOT NULL,
  `effective_from` datetime(3) NOT NULL,
  `effective_to` datetime(3) NULL,
  `created_by` varchar(100) NOT NULL,
  `approved_by` varchar(100) NULL,
  `approved_at` datetime(3) NULL,
  `activated_by` varchar(100) NULL,
  `activated_at` datetime(3) NULL,
  `evidence_sha256` char(64) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_submission_policy_version_uq` (`policy_code`,`version`),
  KEY `operations_submission_policy_active_idx` (`policy_code`,`lifecycle_state`,`effective_from`,`effective_to`),
  CONSTRAINT `operations_submission_policy_effective_ck` CHECK (`effective_to` IS NULL OR `effective_to` > `effective_from`),
  CONSTRAINT `operations_submission_policy_thresholds_ck` CHECK (JSON_VALID(`thresholds_json`))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_submission_policy_events` (
  `id` varchar(36) NOT NULL,
  `policy_id` varchar(36) NOT NULL,
  `from_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED') NULL,
  `to_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED') NOT NULL,
  `version_before` bigint unsigned NOT NULL,
  `version_after` bigint unsigned NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `payload_sha256` char(64) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `operations_submission_policy_event_history_idx` (`policy_id`,`version_after`,`occurred_at`),
  CONSTRAINT `operations_submission_policy_event_policy_fk` FOREIGN KEY (`policy_id`) REFERENCES `operations_submission_policies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_submission_policy_event_version_ck` CHECK (`version_after` = `version_before` + 1)
) ENGINE=InnoDB;

ALTER TABLE `submission_schedule_snapshots`
  MODIFY COLUMN `schedule_state` enum('NOT_EVALUATED','NOT_APPLICABLE','TOO_EARLY','SCHEDULED_FOR_SUBMISSION','RECOMMENDED_WINDOW','SUBMISSION_WINDOW_OPEN','READY_FOR_SUBMISSION','URGENT','BLOCKED_BY_REQUIREMENTS','BLOCKED_BY_MANUAL_REVIEW','OVERDUE','ALREADY_SUBMITTED','HUMAN_REVIEW_REQUIRED') NOT NULL;

DELIMITER $$
CREATE TRIGGER `operations_submission_policy_event_no_update` BEFORE UPDATE ON `operations_submission_policy_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operational policy events are append-only'; END$$
CREATE TRIGGER `operations_submission_policy_event_no_delete` BEFORE DELETE ON `operations_submission_policy_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operational policy events are append-only'; END$$
DELIMITER ;
