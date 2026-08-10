-- Phase 7 architecture only. Review and apply through the approved migration process.
-- This migration is intentionally not executed by the application or CI.

ALTER TABLE `invoices` ALTER COLUMN `vat_rate` DROP DEFAULT;
ALTER TABLE `applications` ALTER COLUMN `exchange_rate` DROP DEFAULT;

CREATE TABLE `pricing_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `service_code` varchar(80) NOT NULL,
  `pricing_processing_type` enum('regular','express') NOT NULL,
  `version` bigint unsigned NOT NULL,
  `supplier_cost` decimal(12,2) NOT NULL,
  `internal_cost` decimal(12,2) NOT NULL,
  `markup` decimal(12,2) NOT NULL,
  `selling_price` decimal(12,2) NOT NULL,
  `promotional_price` decimal(12,2) NULL,
  `minimum_selling_price` decimal(12,2) NOT NULL,
  `pricing_currency` char(3) NOT NULL,
  `effective_at` timestamp NOT NULL,
  `expires_at` timestamp NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pricing_rule_version_uq` (`service_code`,`pricing_processing_type`,`version`),
  KEY `pricing_rule_active_idx` (`service_code`,`pricing_processing_type`,`effective_at`,`expires_at`)
);

CREATE TABLE `business_settings_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `settings_version` bigint unsigned NOT NULL,
  `legal_name` varchar(255) NOT NULL,
  `company_address` text NOT NULL,
  `company_phone` varchar(50) NOT NULL,
  `company_email` varchar(320) NOT NULL,
  `vat_registered` enum('yes','no') NOT NULL,
  `trn` varchar(100) NULL,
  `settings_vat_rate` decimal(7,4) NOT NULL,
  `vat_effective_at` timestamp NULL,
  `registration_threshold` decimal(14,2) NULL,
  `warning_levels_json` text NOT NULL,
  `invoice_prefix` varchar(20) NOT NULL,
  `next_invoice_number` bigint unsigned NOT NULL,
  `base_currency` char(3) NOT NULL,
  `usd_to_base_rate` decimal(14,6) NOT NULL,
  `settings_effective_at` timestamp NOT NULL,
  `settings_created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `business_settings_version_uq` (`settings_version`),
  KEY `business_settings_effective_idx` (`settings_effective_at`)
);

CREATE TABLE `application_price_snapshots` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `pricing_rule_id` bigint unsigned NOT NULL,
  `pricing_version` bigint unsigned NOT NULL,
  `applicant_count` bigint unsigned NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  `snapshot_supplier_cost` decimal(12,2) NOT NULL,
  `snapshot_internal_cost` decimal(12,2) NOT NULL,
  `snapshot_markup` decimal(12,2) NOT NULL,
  `snapshot_minimum_selling_price` decimal(12,2) NOT NULL,
  `snapshot_currency` char(3) NOT NULL,
  `exchange_rate_to_base` decimal(14,6) NOT NULL,
  `snapshot_base_currency` char(3) NOT NULL,
  `total_in_base_currency` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_price_snapshot_uq` (`application_id`),
  CONSTRAINT `price_snapshot_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `price_snapshot_rule_fk` FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `financial_events` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NULL,
  `payment_id` bigint unsigned NULL,
  `financial_event_type` enum('REFUND_REQUESTED','REFUND_COMPLETED','CHARGEBACK_OPENED','CHARGEBACK_WON','CHARGEBACK_LOST') NOT NULL,
  `financial_event_amount` decimal(12,2) NULL,
  `financial_event_currency` char(3) NULL,
  `source_reference` varchar(100) NULL,
  `financial_actor_reference` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `financial_event_application_idx` (`application_id`,`created_at`)
);

CREATE TABLE `application_risk_assessments` (
  `id` varchar(36) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  `risk_score` bigint unsigned NOT NULL,
  `risk_factors_json` text NOT NULL,
  `risk_model_version` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `risk_application_created_idx` (`application_id`,`created_at`)
);

CREATE TABLE `retention_policies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `retention_category` enum('IDENTITY_DOCUMENTS','APPLICATION_RECORDS','PAYMENT_RECORDS','CHARGEBACK_EVIDENCE','AUDIT_LOGS') NOT NULL,
  `duration_days` bigint unsigned NULL,
  `retention_version` bigint unsigned NOT NULL,
  `retention_effective_at` timestamp NOT NULL,
  `retention_created_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `retention_policy_version_uq` (`retention_category`,`retention_version`)
);

CREATE TABLE `retention_records` (
  `id` varchar(36) NOT NULL,
  `record_retention_category` enum('IDENTITY_DOCUMENTS','APPLICATION_RECORDS','PAYMENT_RECORDS','CHARGEBACK_EVIDENCE','AUDIT_LOGS') NOT NULL,
  `retention_subject_type` varchar(50) NOT NULL,
  `retention_subject_reference` varchar(100) NOT NULL,
  `retention_start` timestamp NOT NULL,
  `scheduled_deletion_at` timestamp NULL,
  `legal_hold_active` enum('yes','no') NOT NULL DEFAULT 'no',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `retention_subject_uq` (`record_retention_category`,`retention_subject_type`,`retention_subject_reference`)
);

CREATE TABLE `legal_hold_events` (
  `id` varchar(36) NOT NULL,
  `retention_record_id` varchar(36) NOT NULL,
  `legal_hold_action` enum('PLACED','RELEASED') NOT NULL,
  `legal_hold_reason` varchar(255) NOT NULL,
  `legal_hold_actor` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `legal_hold_record_fk` FOREIGN KEY (`retention_record_id`) REFERENCES `retention_records` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `deletion_audit_events` (
  `id` varchar(36) NOT NULL,
  `deletion_retention_record_id` varchar(36) NOT NULL,
  `deletion_outcome` enum('BLOCKED_LEGAL_HOLD','ELIGIBLE','DELETED','FAILED') NOT NULL,
  `deletion_actor_reference` varchar(100) NOT NULL,
  `deletion_details` varchar(255) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `deletion_audit_record_fk` FOREIGN KEY (`deletion_retention_record_id`) REFERENCES `retention_records` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `customer_recovery_challenges` (
  `id` varchar(36) NOT NULL,
  `recovery_application_id` bigint unsigned NOT NULL,
  `recovery_channel` enum('MAGIC_LINK','EMAIL_OTP','SMS_OTP') NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `destination_hash` varchar(64) NOT NULL,
  `recovery_expires_at` timestamp NOT NULL,
  `recovery_consumed_at` timestamp NULL,
  `recovery_attempt_count` bigint unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `recovery_application_idx` (`recovery_application_id`,`created_at`),
  CONSTRAINT `recovery_application_fk` FOREIGN KEY (`recovery_application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `outbound_email_events` (
  `id` varchar(36) NOT NULL,
  `email_application_id` bigint unsigned NULL,
  `email_template` enum('APPLICATION_RECEIVED','PAYMENT_SUCCESS','PAYMENT_FAILED','DOCUMENTS_REQUIRED','SUBMITTED','VISA_ISSUED','RESUME_LINK') NOT NULL,
  `recipient_hash` varchar(64) NOT NULL,
  `email_provider` varchar(50) NOT NULL,
  `email_status` enum('QUEUED','SENT','FAILED','SUPPRESSED') NOT NULL,
  `email_provider_reference` varchar(100) NULL,
  `email_failure_category` varchar(50) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `outbound_email_application_idx` (`email_application_id`,`created_at`)
);

CREATE TABLE `document_lifecycle_events` (
  `id` varchar(36) NOT NULL,
  `document_event_application_id` bigint unsigned NOT NULL,
  `document_event_document_id` bigint unsigned NULL,
  `document_event_applicant_id` bigint unsigned NULL,
  `replaces_document_id` bigint unsigned NULL,
  `document_lifecycle_event_type` enum('UPLOADED','REPLACED','DELETED','REPLACEMENT_REQUESTED','VALIDATED','REJECTED') NOT NULL,
  `document_version` bigint unsigned NOT NULL,
  `document_event_actor_type` enum('CUSTOMER','STAFF','ADMIN','SYSTEM') NOT NULL,
  `document_event_actor_reference` varchar(100) NULL,
  `document_evidence_reference` varchar(100) NULL,
  `document_event_reason` varchar(255) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_lifecycle_application_idx` (`document_event_application_id`,`created_at`)
);

DELIMITER $$
CREATE TRIGGER `application_timeline_no_update` BEFORE UPDATE ON `application_timeline_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'application timeline is append-only'$$
CREATE TRIGGER `application_timeline_no_delete` BEFORE DELETE ON `application_timeline_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'application timeline is append-only'$$
CREATE TRIGGER `price_snapshot_no_update` BEFORE UPDATE ON `application_price_snapshots`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'price snapshots are immutable'$$
CREATE TRIGGER `price_snapshot_no_delete` BEFORE DELETE ON `application_price_snapshots`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'price snapshots are immutable'$$
CREATE TRIGGER `financial_events_no_update` BEFORE UPDATE ON `financial_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'financial events are append-only'$$
CREATE TRIGGER `financial_events_no_delete` BEFORE DELETE ON `financial_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'financial events are append-only'$$
CREATE TRIGGER `risk_assessments_no_update` BEFORE UPDATE ON `application_risk_assessments`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'risk assessments are append-only'$$
CREATE TRIGGER `risk_assessments_no_delete` BEFORE DELETE ON `application_risk_assessments`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'risk assessments are append-only'$$
CREATE TRIGGER `legal_hold_events_no_update` BEFORE UPDATE ON `legal_hold_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'legal hold events are append-only'$$
CREATE TRIGGER `legal_hold_events_no_delete` BEFORE DELETE ON `legal_hold_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'legal hold events are append-only'$$
CREATE TRIGGER `deletion_audit_no_update` BEFORE UPDATE ON `deletion_audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'deletion audit is append-only'$$
CREATE TRIGGER `deletion_audit_no_delete` BEFORE DELETE ON `deletion_audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'deletion audit is append-only'$$
CREATE TRIGGER `outbound_email_no_update` BEFORE UPDATE ON `outbound_email_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'email events are append-only'$$
CREATE TRIGGER `outbound_email_no_delete` BEFORE DELETE ON `outbound_email_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'email events are append-only'$$
CREATE TRIGGER `document_lifecycle_no_update` BEFORE UPDATE ON `document_lifecycle_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'document lifecycle events are append-only'$$
CREATE TRIGGER `document_lifecycle_no_delete` BEFORE DELETE ON `document_lifecycle_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'document lifecycle events are append-only'$$
DELIMITER ;
