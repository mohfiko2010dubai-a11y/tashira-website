DROP TRIGGER IF EXISTS `dynamic_interview_answers_no_delete`;
DROP TRIGGER IF EXISTS `dynamic_interview_answers_no_update`;
DROP TRIGGER IF EXISTS `catalog_governance_events_no_delete`;
DROP TRIGGER IF EXISTS `catalog_governance_events_no_update`;
DROP TRIGGER IF EXISTS `requirement_questions_governed_update`;
DROP TRIGGER IF EXISTS `requirement_definitions_governed_update`;
DROP TABLE IF EXISTS `dynamic_interview_answer_events`;
DROP TABLE IF EXISTS `requirement_catalog_governance_events`;
ALTER TABLE `requirement_question_definitions` DROP COLUMN `record_version`, DROP COLUMN `governance_state`;
ALTER TABLE `requirement_definitions` DROP COLUMN `record_version`, DROP COLUMN `governance_state`;
DELIMITER $$
CREATE TRIGGER `requirement_definitions_no_update` BEFORE UPDATE ON `requirement_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement catalog versions are immutable'; END$$
CREATE TRIGGER `requirement_questions_no_update` BEFORE UPDATE ON `requirement_question_definitions` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requirement question versions are immutable'; END$$
DELIMITER ;
