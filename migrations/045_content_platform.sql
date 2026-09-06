-- =============================================================
-- 045_content_platform.sql (ADDITIVE ONLY)
-- SEO landing pages + educational guides + visa news CMS.
-- No existing table/column is altered or dropped.
-- =============================================================

-- 1) Content permissions catalog (pattern of 043)
INSERT IGNORE INTO `operations_permissions` (`code`,`description`,`risk_level`) VALUES
  ('content.view','View CMS content items and drafts','LOW'),
  ('content.create','Create CMS content drafts','MEDIUM'),
  ('content.edit','Edit CMS content drafts','MEDIUM'),
  ('content.review','Review and approve CMS content','HIGH'),
  ('content.publish','Publish CMS content publicly','CRITICAL'),
  ('content.unpublish','Unpublish public CMS content','HIGH'),
  ('content.archive','Archive CMS content','MEDIUM'),
  ('content.manage_seo','Manage SEO metadata and validation','MEDIUM'),
  ('content.manage_redirects','Manage URL redirects','MEDIUM'),
  ('content.manage_media','Manage CMS media assets','MEDIUM');

-- 2) Content items (landing pages / guides / news), bilingual via translation groups
CREATE TABLE IF NOT EXISTS `content_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content_type` ENUM('LANDING','GUIDE','NEWS') NOT NULL,
  `language` ENUM('en','ar') NOT NULL,
  `translation_group_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `excerpt` VARCHAR(500) NULL,
  `body_blocks` JSON NOT NULL,
  `hero_image` VARCHAR(500) NULL,
  `hero_image_alt` VARCHAR(255) NULL,
  `category` VARCHAR(100) NULL,
  `tags` JSON NULL,
  `author` VARCHAR(120) NULL,
  `reviewer` VARCHAR(120) NULL,
  `source_authority` VARCHAR(120) NULL,
  `source_url` VARCHAR(500) NULL,
  `source_published_at` DATE NULL,
  `last_verified_at` DATE NULL,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` VARCHAR(320) NULL,
  `canonical_url` VARCHAR(500) NULL,
  `robots` VARCHAR(50) NOT NULL DEFAULT 'index,follow',
  `og_title` VARCHAR(255) NULL,
  `og_description` VARCHAR(320) NULL,
  `og_image` VARCHAR(500) NULL,
  `structured_data` JSON NULL,
  `status` ENUM('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `synthetic_label` TINYINT(1) NOT NULL DEFAULT 0,
  `scheduled_publish_at` TIMESTAMP NULL,
  `created_by` VARCHAR(120) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `published_at` TIMESTAMP NULL,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_items_locale_slug_uniq` (`language`,`slug`),
  UNIQUE KEY `content_items_canonical_uniq` (`canonical_url`),
  KEY `content_items_type_status_idx` (`content_type`,`status`),
  KEY `content_items_translation_group_idx` (`translation_group_id`),
  KEY `content_items_verified_idx` (`last_verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Immutable publication history (append-only snapshots)
CREATE TABLE IF NOT EXISTS `content_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content_id` BIGINT UNSIGNED NOT NULL,
  `version` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor` VARCHAR(120) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_versions_uniq` (`content_id`,`version`),
  CONSTRAINT `content_versions_item_fk` FOREIGN KEY (`content_id`) REFERENCES `content_items` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Redirect manager
CREATE TABLE IF NOT EXISTS `content_redirects` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `from_path` VARCHAR(500) NOT NULL,
  `to_path` VARCHAR(500) NOT NULL,
  `status_code` INT NOT NULL DEFAULT 301,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` VARCHAR(120) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_redirects_from_uniq` (`from_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
