CREATE TABLE IF NOT EXISTS `operations_departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(80) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_department_code_uq` (`code`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_teams` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `department_id` bigint unsigned NOT NULL,
  `code` varchar(80) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_team_code_uq` (`code`),
  KEY `operations_team_department_idx` (`department_id`,`is_active`),
  CONSTRAINT `operations_team_department_fk` FOREIGN KEY (`department_id`) REFERENCES `operations_departments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(80) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_system` enum('YES','NO') NOT NULL DEFAULT 'NO',
  `is_active` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_role_code_uq` (`code`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `description` varchar(500) NOT NULL,
  `risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `operations_permission_code_uq` (`code`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_role_permissions` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `granted_by` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  CONSTRAINT `operations_role_permission_role_fk` FOREIGN KEY (`role_id`) REFERENCES `operations_roles` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_role_permission_permission_fk` FOREIGN KEY (`permission_id`) REFERENCES `operations_permissions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_staff_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `staff_user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `granted_by` varchar(100) NOT NULL,
  `valid_from` datetime NOT NULL,
  `valid_to` datetime NULL,
  `revoked_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `operations_staff_role_active_idx` (`staff_user_id`,`revoked_at`,`valid_from`,`valid_to`),
  CONSTRAINT `operations_staff_role_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_staff_role_role_fk` FOREIGN KEY (`role_id`) REFERENCES `operations_roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `operations_scope_grants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `staff_user_id` bigint unsigned NOT NULL,
  `scope_type` enum('OWN','ASSIGNED','TEAM','DEPARTMENT','ALL') NOT NULL,
  `team_id` bigint unsigned NULL,
  `department_id` bigint unsigned NULL,
  `granted_by` varchar(100) NOT NULL,
  `revoked_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `operations_scope_staff_idx` (`staff_user_id`,`revoked_at`),
  CONSTRAINT `operations_scope_staff_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_scope_team_fk` FOREIGN KEY (`team_id`) REFERENCES `operations_teams` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_scope_department_fk` FOREIGN KEY (`department_id`) REFERENCES `operations_departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `operations_scope_shape_ck` CHECK ((`scope_type` = 'TEAM' AND `team_id` IS NOT NULL AND `department_id` IS NULL) OR (`scope_type` = 'DEPARTMENT' AND `department_id` IS NOT NULL AND `team_id` IS NULL) OR (`scope_type` IN ('OWN','ASSIGNED','ALL') AND `team_id` IS NULL AND `department_id` IS NULL))
) ENGINE=InnoDB;
