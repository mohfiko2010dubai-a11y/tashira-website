-- Purpose: persist document-review concurrency and explicit staff workload limits.
-- Existing documents/staff require no backfill. Missing rows fail closed until configured/lazily initialized.

ALTER TABLE `operations_action_events`
  ADD COLUMN `team_id` bigint unsigned NULL AFTER `new_assignee_reference`,
  ADD KEY `operations_action_team_idx` (`team_id`,`created_at`),
  ADD CONSTRAINT `operations_action_team_fk` FOREIGN KEY (`team_id`) REFERENCES `operations_teams` (`id`) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS `operations_document_controls` (
  `document_id` bigint unsigned NOT NULL,
  `version` bigint unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_id`),
  CONSTRAINT `operations_document_control_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_staff_workload_limits` (
  `staff_user_id` bigint unsigned NOT NULL,
  `workload_limit` bigint unsigned NOT NULL,
  `configured_by` varchar(100) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_user_id`),
  CONSTRAINT `operations_workload_limit_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_workload_limit_positive_ck` CHECK (`workload_limit` > 0)
) ENGINE=InnoDB;
