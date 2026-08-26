-- Review-only regulatory change evidence. Nothing in this schema activates or
-- modifies Visa Rule Registry versions or historical eligibility evidence.

CREATE TABLE IF NOT EXISTS `operations_regulatory_changes` (
  `id` varchar(36) NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `previous_snapshot_id` varchar(36) NOT NULL,
  `current_snapshot_id` varchar(36) NOT NULL,
  `previous_fingerprint` char(64) NOT NULL,
  `current_fingerprint` char(64) NOT NULL,
  `proposed_rule_version` bigint unsigned NOT NULL,
  `current_rule_version` bigint unsigned NULL,
  `impact_areas_json` json NOT NULL,
  `impact_reasons_json` json NOT NULL,
  `current_state` enum('NEW','UNDER_REVIEW','APPROVED','REJECTED','CONFLICT','SOURCE_FAILURE') NOT NULL,
  `version` bigint unsigned NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `changed_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regulatory_change_snapshot_pair_uq` (`source_id`,`previous_snapshot_id`,`current_snapshot_id`),
  KEY `regulatory_change_queue_idx` (`current_state`,`changed_at`,`source_id`),
  CONSTRAINT `regulatory_change_source_fk` FOREIGN KEY (`source_id`) REFERENCES `visa_rule_sources` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `regulatory_change_previous_snapshot_fk` FOREIGN KEY (`previous_snapshot_id`) REFERENCES `visa_rule_source_snapshots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `regulatory_change_current_snapshot_fk` FOREIGN KEY (`current_snapshot_id`) REFERENCES `visa_rule_source_snapshots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `regulatory_change_snapshot_difference_ck` CHECK (`previous_snapshot_id` <> `current_snapshot_id` AND `previous_fingerprint` <> `current_fingerprint`),
  CONSTRAINT `regulatory_change_version_ck` CHECK (`proposed_rule_version` > COALESCE(`current_rule_version`,0))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_regulatory_change_impacts` (
  `change_id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`change_id`,`application_id`),
  CONSTRAINT `regulatory_impact_change_fk` FOREIGN KEY (`change_id`) REFERENCES `operations_regulatory_changes` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `regulatory_impact_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_regulatory_change_events` (
  `id` varchar(36) NOT NULL,
  `change_id` varchar(36) NOT NULL,
  `decision` enum('PROPOSE','START_REVIEW','APPROVE','REJECT','MARK_CONFLICT','SOURCE_FAILURE') NOT NULL,
  `state_after` enum('NEW','UNDER_REVIEW','APPROVED','REJECTED','CONFLICT','SOURCE_FAILURE') NOT NULL,
  `version_before` bigint unsigned NOT NULL,
  `version_after` bigint unsigned NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regulatory_change_event_idempotency_uq` (`change_id`,`idempotency_key`),
  KEY `regulatory_change_event_history_idx` (`change_id`,`version_after`,`occurred_at`),
  CONSTRAINT `regulatory_event_change_fk` FOREIGN KEY (`change_id`) REFERENCES `operations_regulatory_changes` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `regulatory_event_version_ck` CHECK (`version_after` = `version_before` + 1)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `regulatory_change_identity_immutable` BEFORE UPDATE ON `operations_regulatory_changes` FOR EACH ROW BEGIN IF OLD.id<>NEW.id OR OLD.source_id<>NEW.source_id OR OLD.previous_snapshot_id<>NEW.previous_snapshot_id OR OLD.current_snapshot_id<>NEW.current_snapshot_id OR OLD.previous_fingerprint<>NEW.previous_fingerprint OR OLD.current_fingerprint<>NEW.current_fingerprint OR OLD.proposed_rule_version<>NEW.proposed_rule_version OR NOT (OLD.current_rule_version<=>NEW.current_rule_version) OR OLD.impact_areas_json<>NEW.impact_areas_json OR OLD.impact_reasons_json<>NEW.impact_reasons_json OR OLD.created_by<>NEW.created_by OR OLD.changed_at<>NEW.changed_at THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory change evidence is immutable'; END IF; END$$
CREATE TRIGGER `regulatory_change_no_delete` BEFORE DELETE ON `operations_regulatory_changes` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory change evidence cannot be deleted'; END$$
CREATE TRIGGER `regulatory_impact_no_update` BEFORE UPDATE ON `operations_regulatory_change_impacts` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory impact evidence is append-only'; END$$
CREATE TRIGGER `regulatory_impact_no_delete` BEFORE DELETE ON `operations_regulatory_change_impacts` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory impact evidence is append-only'; END$$
CREATE TRIGGER `regulatory_event_no_update` BEFORE UPDATE ON `operations_regulatory_change_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory review events are append-only'; END$$
CREATE TRIGGER `regulatory_event_no_delete` BEFORE DELETE ON `operations_regulatory_change_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Regulatory review events are append-only'; END$$
DELIMITER ;
