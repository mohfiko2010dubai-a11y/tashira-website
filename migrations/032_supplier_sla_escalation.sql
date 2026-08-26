-- Operational supplier timing evidence only. Commercial and financial data is
-- outside this migration.

CREATE TABLE IF NOT EXISTS `operations_supplier_sla_policies` (
  `id` varchar(36) NOT NULL,
  `supplier_id` bigint unsigned NOT NULL,
  `route_code` varchar(100) NULL,
  `version` int unsigned NOT NULL,
  `acknowledgement_minutes` int unsigned NOT NULL,
  `completion_minutes` int unsigned NOT NULL,
  `warning_minutes_before_completion` int unsigned NOT NULL,
  `lifecycle_state` enum('DRAFT','ACTIVE','RETIRED') NOT NULL,
  `source_reference` varchar(255) NOT NULL,
  `effective_from` datetime NOT NULL,
  `effective_to` datetime NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_sla_policy_version_uq` (`supplier_id`,`route_code`,`version`),
  KEY `supplier_sla_policy_lookup_idx` (`supplier_id`,`route_code`,`lifecycle_state`,`effective_from`,`effective_to`),
  CONSTRAINT `supplier_sla_policy_supplier_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_sla_policy_minutes_ck` CHECK (`acknowledgement_minutes` > 0 AND `completion_minutes` > `acknowledgement_minutes` AND `warning_minutes_before_completion` < `completion_minutes`),
  CONSTRAINT `supplier_sla_policy_effective_ck` CHECK (`effective_to` IS NULL OR `effective_to` > `effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_supplier_sla_instances` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `supplier_id` bigint unsigned NOT NULL,
  `policy_id` varchar(36) NOT NULL,
  `policy_snapshot_json` json NOT NULL,
  `started_at` datetime NOT NULL,
  `acknowledgement_due_at` datetime NOT NULL,
  `completion_due_at` datetime NOT NULL,
  `current_state` enum('WAITING_FOR_ACKNOWLEDGEMENT','ACKNOWLEDGEMENT_OVERDUE','IN_PROGRESS','COMPLETION_WARNING','COMPLETION_OVERDUE','COMPLETED','CANCELLED') NOT NULL,
  `current_escalation_level` int unsigned NOT NULL DEFAULT 0,
  `version` bigint unsigned NOT NULL DEFAULT 0,
  `evidence_sha256` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_sla_application_uq` (`application_id`),
  KEY `supplier_sla_queue_idx` (`current_state`,`completion_due_at`,`supplier_id`),
  CONSTRAINT `supplier_sla_instance_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_sla_instance_supplier_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_sla_instance_policy_fk` FOREIGN KEY (`policy_id`) REFERENCES `operations_supplier_sla_policies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_sla_instance_deadline_ck` CHECK (`acknowledgement_due_at` > `started_at` AND `completion_due_at` > `acknowledgement_due_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_supplier_sla_events` (
  `id` varchar(36) NOT NULL,
  `sla_instance_id` varchar(36) NOT NULL,
  `event_type` enum('STARTED','ACKNOWLEDGED','WARNING_RAISED','BREACH_DETECTED','ESCALATED','COMPLETED','CANCELLED') NOT NULL,
  `version_before` bigint unsigned NOT NULL,
  `version_after` bigint unsigned NOT NULL,
  `actor_type` enum('STAFF','ADMIN','SYSTEM') NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `metadata_json` json NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_sla_event_idempotency_uq` (`sla_instance_id`,`idempotency_key`),
  KEY `supplier_sla_event_history_idx` (`sla_instance_id`,`version_after`,`occurred_at`),
  CONSTRAINT `supplier_sla_event_instance_fk` FOREIGN KEY (`sla_instance_id`) REFERENCES `operations_supplier_sla_instances` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `supplier_sla_event_version_ck` CHECK (`version_after` = `version_before` + 1)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `supplier_sla_policy_no_update` BEFORE UPDATE ON `operations_supplier_sla_policies` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA policies are immutable; create a new version'; END$$
CREATE TRIGGER `supplier_sla_policy_no_delete` BEFORE DELETE ON `operations_supplier_sla_policies` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA policy evidence is append-only'; END$$
CREATE TRIGGER `supplier_sla_instance_identity_immutable` BEFORE UPDATE ON `operations_supplier_sla_instances` FOR EACH ROW BEGIN IF OLD.id <> NEW.id OR OLD.application_id <> NEW.application_id OR OLD.supplier_id <> NEW.supplier_id OR OLD.policy_id <> NEW.policy_id OR OLD.policy_snapshot_json <> NEW.policy_snapshot_json OR OLD.started_at <> NEW.started_at OR OLD.acknowledgement_due_at <> NEW.acknowledgement_due_at OR OLD.completion_due_at <> NEW.completion_due_at OR OLD.evidence_sha256 <> NEW.evidence_sha256 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA identity and snapshot are immutable'; END IF; END$$
CREATE TRIGGER `supplier_sla_instance_no_delete` BEFORE DELETE ON `operations_supplier_sla_instances` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA instance evidence cannot be deleted'; END$$
CREATE TRIGGER `supplier_sla_event_no_update` BEFORE UPDATE ON `operations_supplier_sla_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA events are append-only'; END$$
CREATE TRIGGER `supplier_sla_event_no_delete` BEFORE DELETE ON `operations_supplier_sla_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Supplier SLA events are append-only'; END$$
DELIMITER ;
