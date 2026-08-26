CREATE TABLE IF NOT EXISTS `requirement_definitions` (
  `id` varchar(36) NOT NULL,
  `stable_code` varchar(100) NOT NULL,
  `version` int unsigned NOT NULL,
  `status` enum('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `document_type` varchar(100) NOT NULL,
  `customer_label` varchar(200) NOT NULL,
  `short_customer_explanation` varchar(500) NOT NULL,
  `internal_label` varchar(200) NOT NULL,
  `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL,
  `authority_semantics` varchar(500) NULL,
  `reason_template` varchar(500) NOT NULL,
  `category` enum('IDENTITY','TRAVEL','RELATIONSHIP','RESIDENCE','SUPPORTING') NOT NULL,
  `required_capability` boolean NOT NULL DEFAULT true,
  `conditional_capability` boolean NOT NULL DEFAULT false,
  `shared_document_capability` boolean NOT NULL DEFAULT false,
  `applicant_scoped_capability` boolean NOT NULL DEFAULT true,
  `travel_group_scoped_capability` boolean NOT NULL DEFAULT false,
  `family_scoped_capability` boolean NOT NULL DEFAULT false,
  `ai_extraction_capability` boolean NOT NULL DEFAULT false,
  `human_review_policy` enum('ALWAYS','ON_WARNING','ON_MISMATCH','NOT_REQUIRED') NOT NULL,
  `effective_from` datetime(3) NOT NULL,
  `effective_to` datetime(3) NULL,
  `created_by` varchar(100) NOT NULL,
  `review_status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` varchar(100) NULL,
  `reviewed_at` datetime(3) NULL,
  `source_metadata_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `requirement_definition_code_version_uq` (`stable_code`,`version`),
  KEY `requirement_definition_active_idx` (`stable_code`,`status`,`review_status`,`effective_from`,`effective_to`),
  CONSTRAINT `requirement_definition_dates_ck` CHECK (`effective_to` IS NULL OR `effective_to` >= `effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `requirement_question_definitions` (
  `id` varchar(36) NOT NULL,
  `stable_code` varchar(100) NOT NULL,
  `version` int unsigned NOT NULL,
  `status` enum('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `question_type` varchar(100) NOT NULL,
  `customer_label` varchar(200) NOT NULL,
  `short_customer_explanation` varchar(500) NOT NULL,
  `internal_label` varchar(200) NOT NULL,
  `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL,
  `authority_semantics` varchar(500) NULL,
  `reason_template` varchar(500) NOT NULL,
  `help_text` varchar(500) NOT NULL,
  `answer_type` enum('BOOLEAN','SELECT','TEXT','DATE','NUMBER') NOT NULL,
  `allowed_values_json` json NULL,
  `validation_contract_json` json NOT NULL,
  `customer_visible` boolean NOT NULL DEFAULT true,
  `effective_from` datetime(3) NOT NULL,
  `effective_to` datetime(3) NULL,
  `created_by` varchar(100) NOT NULL,
  `review_status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` varchar(100) NULL,
  `reviewed_at` datetime(3) NULL,
  `source_metadata_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `requirement_question_code_version_uq` (`stable_code`,`version`),
  KEY `requirement_question_active_idx` (`stable_code`,`status`,`review_status`,`effective_from`,`effective_to`),
  CONSTRAINT `requirement_question_dates_ck` CHECK (`effective_to` IS NULL OR `effective_to` >= `effective_from`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `requirement_catalog_imports` (
  `id` varchar(36) NOT NULL,
  `import_version` varchar(100) NOT NULL,
  `content_sha256` char(64) NOT NULL,
  `imported_by` varchar(100) NOT NULL,
  `definition_count` int unsigned NOT NULL,
  `question_count` int unsigned NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `requirement_catalog_import_version_uq` (`import_version`),
  UNIQUE KEY `requirement_catalog_import_hash_uq` (`content_sha256`)
) ENGINE=InnoDB;

ALTER TABLE `applicant_requirement_instances`
  ADD COLUMN `requirement_definition_id` varchar(36) NULL AFTER `catalog_version`,
  ADD COLUMN `requirement_definition_version` int unsigned NULL AFTER `requirement_definition_id`,
  ADD COLUMN `source_rule_id` varchar(100) NULL AFTER `requirement_code`,
  ADD COLUMN `source_rule_version` int unsigned NULL AFTER `source_rule_id`,
  ADD COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NULL AFTER `requirement_kind`,
  ADD COLUMN `authority_semantics` varchar(500) NULL AFTER `classification`,
  ADD COLUMN `reason_snapshot` varchar(500) NULL AFTER `authority_semantics`,
  ADD COLUMN `sharing_scope` enum('APPLICANT','TRAVEL_GROUP','FAMILY') NOT NULL DEFAULT 'APPLICANT' AFTER `conditional`,
  ADD COLUMN `validation_policy_snapshot` json NULL AFTER `sharing_scope`,
  ADD CONSTRAINT `applicant_requirement_definition_fk` FOREIGN KEY (`requirement_definition_id`) REFERENCES `requirement_definitions` (`id`) ON DELETE RESTRICT;

DELIMITER $$
CREATE TRIGGER `requirement_definitions_no_update` BEFORE UPDATE ON `requirement_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement catalog versions are immutable'; END$$
CREATE TRIGGER `requirement_definitions_no_delete` BEFORE DELETE ON `requirement_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement catalog versions are immutable'; END$$
CREATE TRIGGER `requirement_questions_no_update` BEFORE UPDATE ON `requirement_question_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement question versions are immutable'; END$$
CREATE TRIGGER `requirement_questions_no_delete` BEFORE DELETE ON `requirement_question_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement question versions are immutable'; END$$
CREATE TRIGGER `requirement_catalog_imports_no_update` BEFORE UPDATE ON `requirement_catalog_imports` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement catalog import evidence is append-only'; END$$
CREATE TRIGGER `requirement_catalog_imports_no_delete` BEFORE DELETE ON `requirement_catalog_imports` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement catalog import evidence is append-only'; END$$
DELIMITER ;
