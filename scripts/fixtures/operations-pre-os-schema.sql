-- Synthetic pre-Operations-OS baseline for disposable MySQL rehearsal only.
-- This is intentionally minimal but preserves the exact parent key types used by migrations 014-020.
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `union_id` varchar(255) NOT NULL,
  `name` varchar(255) NULL,
  `email` varchar(320) NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `users_union_id_uq` (`union_id`)
) ENGINE=InnoDB;

CREATE TABLE `staff_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320) NULL,
  `is_active` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `staff_username_uq` (`username`)
) ENGINE=InnoDB;

CREATE TABLE `suppliers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `is_active` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `applications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reference_number` varchar(50) NOT NULL,
  `base_type` enum('single','family') NOT NULL,
  `residence_type` enum('non-gcc','gcc-resident','non-gcc-accompany','gcc-accompany') NOT NULL,
  `visa_type` varchar(50) NOT NULL,
  `processing_type` enum('regular','express') NOT NULL,
  `contact_email` varchar(320) NOT NULL,
  `contact_phone` varchar(50) NOT NULL,
  `exchange_rate` decimal(10,4) NOT NULL,
  `total_amount_aed` decimal(10,2) NOT NULL,
  `total_amount_usd` decimal(10,2) NULL,
  `supplier_id` bigint unsigned NULL,
  `supplier_cost_aed` decimal(10,2) NULL,
  `status` enum('submitted','payment_received','documents_pending','documents_received','under_review','visa_processing','visa_received','completed','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  `payment_status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
  `stripe_payment_intent_id` varchar(100) NULL,
  `invoice_number` varchar(50) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `application_reference_uq` (`reference_number`),
  CONSTRAINT `application_supplier_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `applicants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `applicant_index` bigint unsigned NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `nationality` varchar(100) NULL,
  `passport_number` varchar(100) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `applicant_application_index_uq` (`application_id`,`applicant_index`),
  CONSTRAINT `applicant_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `applicant_id` bigint unsigned NULL,
  `document_type` enum('passport','photo','national_id','supporting','visa','invoice','gcc_residence','sponsor_id') NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint unsigned NOT NULL,
  `storage_path` varchar(500) NOT NULL,
  `upload_status` enum('pending','uploaded','failed','replaced') NOT NULL DEFAULT 'uploaded',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `document_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `document_applicant_fk` FOREIGN KEY (`applicant_id`) REFERENCES `applicants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `stripe_payment_intent_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) NOT NULL,
  `status` enum('pending','succeeded','failed') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), CONSTRAINT `payment_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) NOT NULL,
  `application_id` bigint unsigned NOT NULL,
  `payment_id` bigint unsigned NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `invoice_number_uq` (`invoice_number`),
  CONSTRAINT `invoice_application_fk` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `invoice_payment_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;
