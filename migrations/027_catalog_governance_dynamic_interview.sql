ALTER TABLE `requirement_definitions`
  ADD COLUMN `governance_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED','RETIRED') NOT NULL DEFAULT 'DRAFT' AFTER `status`,
  ADD COLUMN `record_version` int unsigned NOT NULL DEFAULT 1 AFTER `governance_state`;
ALTER TABLE `requirement_question_definitions`
  ADD COLUMN `governance_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED','RETIRED') NOT NULL DEFAULT 'DRAFT' AFTER `status`,
  ADD COLUMN `record_version` int unsigned NOT NULL DEFAULT 1 AFTER `governance_state`;

CREATE TABLE IF NOT EXISTS `requirement_catalog_governance_events` (
  `id` varchar(36) NOT NULL, `definition_id` varchar(36) NOT NULL,
  `definition_kind` enum('REQUIREMENT','QUESTION') NOT NULL,
  `from_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED','RETIRED') NULL,
  `to_state` enum('DRAFT','REVIEW','APPROVED','ACTIVE','REJECTED','SUPERSEDED','RETIRED') NOT NULL,
  `actor_reference` varchar(100) NOT NULL, `reason` varchar(500) NOT NULL,
  `payload_sha256` char(64) NOT NULL, `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  KEY `catalog_governance_definition_idx` (`definition_kind`,`definition_id`,`occurred_at`,`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `dynamic_interview_answer_events` (
  `id` varchar(36) NOT NULL, `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NULL, `question_definition_id` varchar(36) NOT NULL,
  `question_definition_version` int unsigned NOT NULL, `answer_json` json NOT NULL,
  `answer_sha256` char(64) NOT NULL, `supersedes_event_id` varchar(36) NULL,
  `change_reason` varchar(500) NOT NULL, `actor_type` enum('CUSTOMER','STAFF','ADMIN','SYSTEM') NOT NULL,
  `actor_reference` varchar(100) NOT NULL, `occurred_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  UNIQUE KEY `dynamic_answer_hash_uq` (`application_id`,`applicant_id`,`question_definition_id`,`answer_sha256`),
  KEY `dynamic_answer_current_idx` (`application_id`,`applicant_id`,`question_definition_id`,`occurred_at`,`id`),
  CONSTRAINT `dynamic_answer_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `dynamic_answer_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `dynamic_answer_question_fk` FOREIGN KEY (`question_definition_id`) REFERENCES `requirement_question_definitions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `dynamic_answer_supersedes_fk` FOREIGN KEY (`supersedes_event_id`) REFERENCES `dynamic_interview_answer_events` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS `requirement_definitions_no_update`;
DROP TRIGGER IF EXISTS `requirement_questions_no_update`;
DELIMITER $$
CREATE TRIGGER `requirement_definitions_governed_update` BEFORE UPDATE ON `requirement_definitions` FOR EACH ROW BEGIN IF NEW.record_version<>OLD.record_version+1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Requirement definition version conflict'; END IF; IF OLD.governance_state NOT IN ('DRAFT','REJECTED') AND (NOT (NEW.stable_code<=>OLD.stable_code) OR NOT (NEW.version<=>OLD.version) OR NOT (NEW.document_type<=>OLD.document_type) OR NOT (NEW.customer_label<=>OLD.customer_label) OR NOT (NEW.short_customer_explanation<=>OLD.short_customer_explanation) OR NOT (NEW.internal_label<=>OLD.internal_label) OR NOT (NEW.classification<=>OLD.classification) OR NOT (NEW.authority_semantics<=>OLD.authority_semantics) OR NOT (NEW.reason_template<=>OLD.reason_template) OR NOT (NEW.category<=>OLD.category) OR NOT (NEW.required_capability<=>OLD.required_capability) OR NOT (NEW.conditional_capability<=>OLD.conditional_capability) OR NOT (NEW.shared_document_capability<=>OLD.shared_document_capability) OR NOT (NEW.applicant_scoped_capability<=>OLD.applicant_scoped_capability) OR NOT (NEW.travel_group_scoped_capability<=>OLD.travel_group_scoped_capability) OR NOT (NEW.family_scoped_capability<=>OLD.family_scoped_capability) OR NOT (NEW.ai_extraction_capability<=>OLD.ai_extraction_capability) OR NOT (NEW.human_review_policy<=>OLD.human_review_policy) OR NOT (NEW.effective_from<=>OLD.effective_from) OR NOT (NEW.effective_to<=>OLD.effective_to) OR NOT (NEW.source_metadata_json<=>OLD.source_metadata_json)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submitted requirement definition content is immutable'; END IF; END$$
CREATE TRIGGER `requirement_questions_governed_update` BEFORE UPDATE ON `requirement_question_definitions` FOR EACH ROW BEGIN IF NEW.record_version<>OLD.record_version+1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Question definition version conflict'; END IF; IF OLD.governance_state NOT IN ('DRAFT','REJECTED') AND (NOT (NEW.stable_code<=>OLD.stable_code) OR NOT (NEW.version<=>OLD.version) OR NOT (NEW.question_type<=>OLD.question_type) OR NOT (NEW.customer_label<=>OLD.customer_label) OR NOT (NEW.short_customer_explanation<=>OLD.short_customer_explanation) OR NOT (NEW.internal_label<=>OLD.internal_label) OR NOT (NEW.classification<=>OLD.classification) OR NOT (NEW.authority_semantics<=>OLD.authority_semantics) OR NOT (NEW.reason_template<=>OLD.reason_template) OR NOT (NEW.help_text<=>OLD.help_text) OR NOT (NEW.answer_type<=>OLD.answer_type) OR NOT (NEW.allowed_values_json<=>OLD.allowed_values_json) OR NOT (NEW.validation_contract_json<=>OLD.validation_contract_json) OR NOT (NEW.customer_visible<=>OLD.customer_visible) OR NOT (NEW.effective_from<=>OLD.effective_from) OR NOT (NEW.effective_to<=>OLD.effective_to) OR NOT (NEW.source_metadata_json<=>OLD.source_metadata_json)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submitted question definition content is immutable'; END IF; END$$
CREATE TRIGGER `catalog_governance_events_no_update` BEFORE UPDATE ON `requirement_catalog_governance_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Catalog governance evidence is append-only'; END$$
CREATE TRIGGER `catalog_governance_events_no_delete` BEFORE DELETE ON `requirement_catalog_governance_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Catalog governance evidence is append-only'; END$$
CREATE TRIGGER `dynamic_interview_answers_no_update` BEFORE UPDATE ON `dynamic_interview_answer_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Dynamic interview answer history is append-only'; END$$
CREATE TRIGGER `dynamic_interview_answers_no_delete` BEFORE DELETE ON `dynamic_interview_answer_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Dynamic interview answer history is append-only'; END$$
DELIMITER ;
