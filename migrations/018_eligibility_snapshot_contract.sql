ALTER TABLE `visa_rule_evaluation_runs`
  ADD COLUMN `reevaluation_reason` varchar(500) NULL AFTER `manual_review_reason`,
  ADD COLUMN `warnings_json` json NOT NULL AFTER `conditional_documents_json`,
  ADD COLUMN `precedence_trace_json` json NOT NULL AFTER `warnings_json`,
  ADD COLUMN `supersedes_evaluation_id` varchar(36) NULL AFTER `precedence_trace_json`,
  ADD KEY `visa_rule_evaluation_supersedes_idx` (`supersedes_evaluation_id`),
  ADD CONSTRAINT `visa_rule_evaluation_supersedes_fk` FOREIGN KEY (`supersedes_evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS `visa_rule_evaluation_selections` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `evaluation_id` varchar(36) NOT NULL,
  `selection_reason` varchar(500) NOT NULL,
  `selected_by` varchar(100) NOT NULL,
  `selected_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_selection_current_idx` (`application_id`,`applicant_id`,`selected_at`,`id`),
  UNIQUE KEY `visa_rule_selection_event_uq` (`application_id`,`applicant_id`,`evaluation_id`),
  CONSTRAINT `visa_rule_selection_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_selection_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `visa_rule_selection_evaluation_fk` FOREIGN KEY (`evaluation_id`) REFERENCES `visa_rule_evaluation_runs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `visa_rule_evaluation_selection_no_update` BEFORE UPDATE ON `visa_rule_evaluation_selections` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility evaluation selection history is append-only'; END$$
CREATE TRIGGER `visa_rule_evaluation_selection_no_delete` BEFORE DELETE ON `visa_rule_evaluation_selections` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Eligibility evaluation selection history is append-only'; END$$
DELIMITER ;
