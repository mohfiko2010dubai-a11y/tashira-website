-- Persistent internal Support Inbox foundation. Provider ingestion and outbound
-- delivery remain disabled until separately configured and approved.

CREATE TABLE IF NOT EXISTS `operations_support_threads` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NULL,
  `customer_reference` varchar(100) NOT NULL,
  `state` enum('UNASSIGNED','ASSIGNED','IN_PROGRESS','WAITING_FOR_CUSTOMER','RESOLVED') NOT NULL DEFAULT 'UNASSIGNED',
  `priority` enum('NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  `assigned_staff_user_id` bigint unsigned NULL,
  `team_id` bigint unsigned NOT NULL,
  `unread_count` int unsigned NOT NULL DEFAULT 0,
  `sla_due_at` datetime NOT NULL,
  `version` bigint unsigned NOT NULL DEFAULT 0,
  `last_message_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `support_thread_team_queue_idx` (`team_id`,`state`,`priority`,`sla_due_at`),
  KEY `support_thread_assignee_idx` (`assigned_staff_user_id`,`state`,`updated_at`),
  KEY `support_thread_application_idx` (`application_id`,`updated_at`),
  CONSTRAINT `support_thread_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_thread_staff_fk` FOREIGN KEY (`assigned_staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_thread_team_fk` FOREIGN KEY (`team_id`) REFERENCES `operations_teams` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_thread_link_ck` CHECK (`application_id` IS NOT NULL OR `customer_reference` <> '')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_support_messages` (
  `id` varchar(36) NOT NULL,
  `provider_message_id` varchar(255) NOT NULL,
  `thread_id` varchar(36) NOT NULL,
  `channel` enum('EMAIL','CHAT') NOT NULL,
  `direction` enum('INBOUND','OUTBOUND') NOT NULL,
  `application_id` bigint unsigned NULL,
  `customer_reference` varchar(100) NULL,
  `sanitized_body` text NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `audit_reference` varchar(100) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `support_message_provider_uq` (`provider_message_id`),
  KEY `support_message_thread_idx` (`thread_id`,`occurred_at`,`id`),
  CONSTRAINT `support_message_thread_fk` FOREIGN KEY (`thread_id`) REFERENCES `operations_support_threads` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_message_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_message_link_ck` CHECK (`application_id` IS NOT NULL OR `customer_reference` IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_support_internal_notes` (
  `id` varchar(36) NOT NULL,
  `thread_id` varchar(36) NOT NULL,
  `staff_user_id` bigint unsigned NOT NULL,
  `body` text NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `support_note_thread_idx` (`thread_id`,`occurred_at`,`id`),
  CONSTRAINT `support_note_thread_fk` FOREIGN KEY (`thread_id`) REFERENCES `operations_support_threads` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_note_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_support_command_events` (
  `id` varchar(36) NOT NULL,
  `thread_id` varchar(36) NOT NULL,
  `command_id` varchar(100) NOT NULL,
  `command_sha256` char(64) NOT NULL,
  `action` enum('CLAIM','ASSIGN','REASSIGN','START','WAIT_FOR_CUSTOMER','RESOLVE','ADD_INTERNAL_NOTE') NOT NULL,
  `actor_staff_user_id` bigint unsigned NOT NULL,
  `target_staff_user_id` bigint unsigned NULL,
  `state_before` varchar(40) NOT NULL,
  `state_after` varchar(40) NOT NULL,
  `version_before` bigint unsigned NOT NULL,
  `version_after` bigint unsigned NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `support_command_thread_uq` (`thread_id`,`command_id`),
  KEY `support_command_thread_idx` (`thread_id`,`occurred_at`,`id`),
  CONSTRAINT `support_command_thread_fk` FOREIGN KEY (`thread_id`) REFERENCES `operations_support_threads` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_command_actor_fk` FOREIGN KEY (`actor_staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_command_target_fk` FOREIGN KEY (`target_staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `support_command_version_ck` CHECK (`version_after` = `version_before` + 1)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `support_messages_no_update` BEFORE UPDATE ON `operations_support_messages` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support message evidence is append-only'; END$$
CREATE TRIGGER `support_messages_no_delete` BEFORE DELETE ON `operations_support_messages` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support message evidence is append-only'; END$$
CREATE TRIGGER `support_notes_no_update` BEFORE UPDATE ON `operations_support_internal_notes` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support internal notes are append-only'; END$$
CREATE TRIGGER `support_notes_no_delete` BEFORE DELETE ON `operations_support_internal_notes` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support internal notes are append-only'; END$$
CREATE TRIGGER `support_commands_no_update` BEFORE UPDATE ON `operations_support_command_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support command evidence is append-only'; END$$
CREATE TRIGGER `support_commands_no_delete` BEFORE DELETE ON `operations_support_command_events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Support command evidence is append-only'; END$$
DELIMITER ;
