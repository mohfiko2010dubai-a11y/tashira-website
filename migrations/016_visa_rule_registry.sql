CREATE TABLE IF NOT EXISTS `visa_rule_sources` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `authority` varchar(255) NOT NULL,
  `title` varchar(500) NOT NULL,
  `source_url` varchar(1000) NOT NULL,
  `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL,
  `is_active` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visa_rule_source_url_uq` (`source_url`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_source_snapshots` (
  `id` varchar(36) NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `retrieved_at` datetime NOT NULL,
  `fingerprint_sha256` varchar(64) NOT NULL,
  `content_reference` varchar(500) NOT NULL,
  `retrieval_status` enum('SUCCESS','FAILED','AMBIGUOUS') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visa_rule_source_fingerprint_uq` (`source_id`,`fingerprint_sha256`),
  KEY `visa_rule_source_snapshot_idx` (`source_id`,`retrieved_at`),
  CONSTRAINT `visa_rule_snapshot_source_fk` FOREIGN KEY (`source_id`) REFERENCES `visa_rule_sources` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_sets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stable_id` varchar(80) NOT NULL,
  `route_code` varchar(80) NOT NULL,
  `profile_code` varchar(80) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visa_rule_set_stable_uq` (`stable_id`),
  KEY `visa_rule_set_route_profile_idx` (`route_code`,`profile_code`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_versions` (
  `id` varchar(36) NOT NULL,
  `rule_set_id` bigint unsigned NOT NULL,
  `version` bigint unsigned NOT NULL,
  `status` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','RETIRED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL,
  `research_status` enum('VALIDATED','NOT_RESEARCHED','MANUAL_REVIEW_REQUIRED') NOT NULL,
  `source_snapshot_id` varchar(36) NOT NULL,
  `effective_from` datetime NOT NULL,
  `effective_to` datetime NULL,
  `conditions_json` json NOT NULL,
  `outcome_json` json NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `visa_rule_version_uq` (`rule_set_id`,`version`),
  KEY `visa_rule_version_active_idx` (`rule_set_id`,`status`,`effective_from`,`effective_to`),
  CONSTRAINT `visa_rule_version_set_fk` FOREIGN KEY (`rule_set_id`) REFERENCES `visa_rule_sets` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_version_snapshot_fk` FOREIGN KEY (`source_snapshot_id`) REFERENCES `visa_rule_source_snapshots` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_effective_interval_ck` CHECK (`effective_to` IS NULL OR `effective_to` > `effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_reviews` (
  `id` varchar(36) NOT NULL,
  `rule_version_id` varchar(36) NOT NULL,
  `decision` enum('APPROVED','REJECTED','CHANGES_REQUIRED') NOT NULL,
  `reviewer_reference` varchar(100) NOT NULL,
  `comment` varchar(1000) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_review_version_idx` (`rule_version_id`,`created_at`),
  CONSTRAINT `visa_rule_review_version_fk` FOREIGN KEY (`rule_version_id`) REFERENCES `visa_rule_versions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;
