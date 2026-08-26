-- Provider-independent Operations email queue. This migration sends no email,
-- stores no plaintext recipient address and activates no feature.

CREATE TABLE IF NOT EXISTS `operations_email_dispatches` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `timeline_event_id` varchar(36) NOT NULL,
  `event_name` varchar(80) NOT NULL,
  `template_version` varchar(100) NOT NULL,
  `recipient_sha256` char(64) NOT NULL,
  `deduplication_key` varchar(160) NOT NULL,
  `command_sha256` char(64) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_email_dispatch_dedup_uq` (`deduplication_key`),
  UNIQUE KEY `operations_email_dispatch_event_template_uq` (`timeline_event_id`,`template_version`),
  KEY `operations_email_dispatch_application_idx` (`application_id`,`created_at`,`id`),
  CONSTRAINT `operations_email_dispatch_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_email_dispatch_timeline_fk` FOREIGN KEY (`timeline_event_id`) REFERENCES `application_timeline_events` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_email_dispatch_events` (
  `id` varchar(36) NOT NULL,
  `dispatch_id` varchar(36) NOT NULL,
  `delivery_status` enum('QUEUED','SENT','FAILED','SUPPRESSED') NOT NULL,
  `provider_message_id` varchar(255) NULL,
  `failure_category` varchar(80) NULL,
  `occurred_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_email_provider_message_uq` (`provider_message_id`),
  KEY `operations_email_event_dispatch_idx` (`dispatch_id`,`occurred_at`,`id`),
  CONSTRAINT `operations_email_event_dispatch_fk` FOREIGN KEY (`dispatch_id`) REFERENCES `operations_email_dispatches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_email_event_shape_ck` CHECK (
    (`delivery_status` = 'SENT' AND `provider_message_id` IS NOT NULL AND `failure_category` IS NULL)
    OR (`delivery_status` = 'FAILED' AND `provider_message_id` IS NULL AND `failure_category` IS NOT NULL)
    OR (`delivery_status` IN ('QUEUED','SUPPRESSED') AND `provider_message_id` IS NULL)
  )
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `operations_email_dispatch_identity_guard` BEFORE INSERT ON `operations_email_dispatches` FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM `application_timeline_events` e WHERE e.`id`=NEW.`timeline_event_id`
    AND e.`application_id`=NEW.`application_id` AND e.`event_name`=NEW.`event_name`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations email source event ownership mismatch';
  END IF;
END$$
CREATE TRIGGER `operations_email_dispatch_no_update` BEFORE UPDATE ON `operations_email_dispatches` FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations email dispatch evidence is immutable'; END$$
CREATE TRIGGER `operations_email_dispatch_no_delete` BEFORE DELETE ON `operations_email_dispatches` FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations email dispatch evidence is immutable'; END$$
CREATE TRIGGER `operations_email_dispatch_event_no_update` BEFORE UPDATE ON `operations_email_dispatch_events` FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations email delivery evidence is append-only'; END$$
CREATE TRIGGER `operations_email_dispatch_event_no_delete` BEFORE DELETE ON `operations_email_dispatch_events` FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operations email delivery evidence is append-only'; END$$
DELIMITER ;
