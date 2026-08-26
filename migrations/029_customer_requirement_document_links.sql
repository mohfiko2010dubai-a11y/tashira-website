ALTER TABLE `customer_interview_command_events`
  MODIFY COLUMN `command_type` enum(
    'DEFINE_RELATIONSHIP','DEFINE_TRAVEL_GROUP','UPDATE_TRAVEL_GROUP','LINK_SHARED_DOCUMENT','LINK_REQUIREMENT_DOCUMENT'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS `applicant_requirement_document_links` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NOT NULL,
  `requirement_instance_id` varchar(36) NOT NULL,
  `document_id` bigint unsigned NOT NULL,
  `requirement_code` varchar(100) NOT NULL,
  `evidence_sha256` char(64) NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `linked_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `requirement_document_instance_document_uq` (`requirement_instance_id`,`document_id`),
  KEY `requirement_document_application_applicant_idx` (`application_id`,`applicant_id`,`linked_at`,`id`),
  KEY `requirement_document_document_idx` (`document_id`),
  CONSTRAINT `requirement_document_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `requirement_document_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `requirement_document_instance_fk` FOREIGN KEY (`requirement_instance_id`) REFERENCES `applicant_requirement_instances` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `requirement_document_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `requirement_document_links_no_update` BEFORE UPDATE ON `applicant_requirement_document_links` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement document links are append-only'; END$$
CREATE TRIGGER `requirement_document_links_no_delete` BEFORE DELETE ON `applicant_requirement_document_links` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement document links are append-only'; END$$
DELIMITER ;
