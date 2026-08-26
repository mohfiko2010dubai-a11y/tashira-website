DROP TRIGGER IF EXISTS `customer_command_events_no_delete`;
DROP TRIGGER IF EXISTS `customer_command_events_no_update`;
DROP TRIGGER IF EXISTS `customer_profile_events_no_delete`;
DROP TRIGGER IF EXISTS `customer_profile_events_no_update`;
DROP TABLE IF EXISTS `customer_interview_command_events`;
DROP TABLE IF EXISTS `customer_interview_profile_events`;
ALTER TABLE `applicants` DROP COLUMN `profile_version`;
