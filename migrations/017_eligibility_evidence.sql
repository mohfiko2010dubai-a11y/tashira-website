CREATE TABLE IF NOT EXISTS `visa_rule_evaluation_runs` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NULL,
  `applicant_id` bigint unsigned NULL,
  `route_code` varchar(80) NOT NULL,
  `engine_version` varchar(50) NOT NULL,
  `final_eligibility_state` enum('ELIGIBLE','INELIGIBLE','HUMAN_REVIEW_REQUIRED','RULE_CONFLICT') NOT NULL,
  `decision_reason` varchar(500) NOT NULL,
  `manual_review_reason` varchar(500) NULL,
  `required_documents_json` json NOT NULL,
  `conditional_documents_json` json NOT NULL,
  `evidence_sha256` varchar(64) NOT NULL,
  `evaluated_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_evaluation_application_idx` (`application_id`,`applicant_id`,`evaluated_at`),
  KEY `visa_rule_evaluation_state_idx` (`final_eligibility_state`,`evaluated_at`),
  CONSTRAINT `visa_rule_evaluation_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_evaluation_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_evaluation_owner_ck` CHECK (`applicant_id` IS NULL OR `application_id` IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_evaluation_matches` (
  `evaluation_id` varchar(36) NOT NULL,
  `sequence_number` bigint unsigned NOT NULL,
  `rule_version_id` varchar(36) NOT NULL,
  `stable_rule_id` varchar(80) NOT NULL,
  `rule_version_number` bigint unsigned NOT NULL,
  `rule_layer` enum('BASE_ROUTE','NATIONALITY_OVERLAY','RESIDENCE_OVERLAY','GCC_OVERLAY','AGE_MINOR_OVERLAY','FAMILY_OVERLAY','OPERATIONAL_OVERLAY') NOT NULL,
  `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL,
  `source_authority` varchar(255) NOT NULL,
  `match_reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`evaluation_id`,`sequence_number`),
  UNIQUE KEY `visa_rule_evaluation_rule_uq` (`evaluation_id`,`rule_version_id`),
  CONSTRAINT `visa_rule_evaluation_match_run_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_evaluation_match_version_fk` FOREIGN KEY (`rule_version_id`) REFERENCES `visa_rule_versions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `visa_rule_evaluation_conflicts` (
  `id` varchar(36) NOT NULL,
  `evaluation_id` varchar(36) NOT NULL,
  `conflict_code` varchar(100) NOT NULL,
  `conflict_detail` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_evaluation_conflict_idx` (`evaluation_id`,`created_at`),
  CONSTRAINT `visa_rule_evaluation_conflict_run_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `visa_rule_evaluation_run_no_update` BEFORE UPDATE ON `visa_rule_evaluation_runs` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility evaluation evidence is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_run_no_delete` BEFORE DELETE ON `visa_rule_evaluation_runs` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility evaluation evidence is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_match_no_update` BEFORE UPDATE ON `visa_rule_evaluation_matches` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility matched-rule evidence is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_match_no_delete` BEFORE DELETE ON `visa_rule_evaluation_matches` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility matched-rule evidence is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_conflict_no_update` BEFORE UPDATE ON `visa_rule_evaluation_conflicts` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility conflict evidence is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_conflict_no_delete` BEFORE DELETE ON `visa_rule_evaluation_conflicts` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility conflict evidence is append-only'; END$$
DELIMITER ;
