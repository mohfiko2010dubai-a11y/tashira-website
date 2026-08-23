DROP TRIGGER IF EXISTS `visa_rule_evaluation_selection_no_delete`;
DROP TRIGGER IF EXISTS `visa_rule_evaluation_selection_no_update`;
DROP TABLE IF EXISTS `visa_rule_evaluation_selections`;
ALTER TABLE `visa_rule_evaluation_runs`
  DROP FOREIGN KEY `visa_rule_evaluation_supersedes_fk`,
  DROP INDEX `visa_rule_evaluation_supersedes_idx`,
  DROP COLUMN `supersedes_evaluation_id`,
  DROP COLUMN `precedence_trace_json`,
  DROP COLUMN `warnings_json`,
  DROP COLUMN `reevaluation_reason`;
