DROP TRIGGER IF EXISTS `visa_rule_governance_event_no_delete`;
DROP TRIGGER IF EXISTS `visa_rule_governance_event_no_update`;

SET @visa_rule_event_count := (SELECT COUNT(*) FROM `visa_rule_governance_events`);
SET @visa_rule_rollback_sql := IF(
  @visa_rule_event_count = 0,
  'DROP TABLE `visa_rule_governance_events`',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT=''Rollback blocked: visa rule governance evidence exists'''
);
PREPARE visa_rule_rollback_statement FROM @visa_rule_rollback_sql;
EXECUTE visa_rule_rollback_statement;
DEALLOCATE PREPARE visa_rule_rollback_statement;
