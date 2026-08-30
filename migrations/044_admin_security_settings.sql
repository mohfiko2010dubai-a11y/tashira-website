-- Admin security settings: optional DB-backed admin password override + session epoch.
-- A NULL password_hash keeps the environment variable ADMIN_PASSWORD as the source of truth.
-- session_epoch is incremented on every password change, invalidating all older admin session cookies.
CREATE TABLE IF NOT EXISTS `admin_security_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `password_hash` varchar(255) NULL,
  `session_epoch` int NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(100) NOT NULL DEFAULT 'system',
  PRIMARY KEY (`id`)
);
INSERT IGNORE INTO `admin_security_settings` (`id`, `password_hash`, `session_epoch`, `updated_by`)
VALUES (1, NULL, 1, 'migration-044');
