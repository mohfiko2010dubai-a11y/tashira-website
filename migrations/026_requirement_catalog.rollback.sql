ALTER TABLE `applicant_requirement_instances`
  DROP FOREIGN KEY `applicant_requirement_definition_fk`,
  DROP COLUMN `validation_policy_snapshot`,
  DROP COLUMN `sharing_scope`,
  DROP COLUMN `reason_snapshot`,
  DROP COLUMN `authority_semantics`,
  DROP COLUMN `classification`,
  DROP COLUMN `source_rule_version`,
  DROP COLUMN `source_rule_id`,
  DROP COLUMN `requirement_definition_version`,
  DROP COLUMN `requirement_definition_id`;
DROP TRIGGER IF EXISTS `requirement_catalog_imports_no_delete`;
DROP TRIGGER IF EXISTS `requirement_catalog_imports_no_update`;
DROP TRIGGER IF EXISTS `requirement_questions_no_delete`;
DROP TRIGGER IF EXISTS `requirement_questions_no_update`;
DROP TRIGGER IF EXISTS `requirement_definitions_no_delete`;
DROP TRIGGER IF EXISTS `requirement_definitions_no_update`;
DROP TABLE IF EXISTS `requirement_catalog_imports`;
DROP TABLE IF EXISTS `requirement_question_definitions`;
DROP TABLE IF EXISTS `requirement_definitions`;
