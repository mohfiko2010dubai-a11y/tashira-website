CREATE TABLE IF NOT EXISTS `operations_audit_events` (
  `id` varchar(36) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `actor_type` enum('CUSTOMER','STAFF','ADMIN','SYSTEM','AI') NOT NULL,
  `actor_reference` varchar(100) NULL,
  `resource_type` varchar(80) NOT NULL,
  `resource_reference` varchar(100) NOT NULL,
  `outcome` enum('SUCCESS','DENIED','FAILURE') NOT NULL,
  `reason_code` varchar(100) NULL,
  `metadata_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `operations_audit_resource_idx` (`resource_type`,`resource_reference`,`created_at`),
  KEY `operations_audit_actor_idx` (`actor_type`,`actor_reference`,`created_at`),
  KEY `operations_audit_event_idx` (`event_type`,`created_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_feature_flags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `flag_key` varchar(100) NOT NULL,
  `environment` enum('DEVELOPMENT','TEST','STAGING','PRODUCTION') NOT NULL,
  `enabled` enum('YES','NO') NOT NULL DEFAULT 'NO',
  `scope_type` enum('GLOBAL','TEAM','STAFF','APPLICATION') NOT NULL DEFAULT 'GLOBAL',
  `scope_reference` varchar(100) NOT NULL DEFAULT '',
  `reason` varchar(500) NOT NULL,
  `changed_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_feature_flag_scope_uq` (`flag_key`,`environment`,`scope_type`,`scope_reference`),
  CONSTRAINT `operations_feature_flag_scope_ck` CHECK ((`scope_type` = 'GLOBAL' AND `scope_reference` = '') OR (`scope_type` <> 'GLOBAL' AND `scope_reference` <> ''))
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `operations_audit_no_update` BEFORE UPDATE ON `operations_audit_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations audit events are append-only'; END$$
CREATE TRIGGER `operations_audit_no_delete` BEFORE DELETE ON `operations_audit_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations audit events are append-only'; END$$
DELIMITER ;
