-- Rollback for 045_content_platform.sql (drops ONLY tables created there)
DELETE FROM `operations_permissions` WHERE `code` IN (
  'content.view','content.create','content.edit','content.review','content.publish',
  'content.unpublish','content.archive','content.manage_seo','content.manage_redirects','content.manage_media');
DROP TABLE IF EXISTS `content_versions`;
DROP TABLE IF EXISTS `content_redirects`;
DROP TABLE IF EXISTS `content_items`;
