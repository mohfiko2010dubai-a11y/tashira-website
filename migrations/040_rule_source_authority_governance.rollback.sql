DROP TRIGGER IF EXISTS `visa_rule_source_authority_event_no_delete`;
DROP TRIGGER IF EXISTS `visa_rule_source_authority_event_no_update`;

SET @source_authority_event_count := (SELECT COUNT(*) FROM `visa_rule_source_authority_events`);
SET @source_authority_rollback_sql := IF(
  @source_authority_event_count = 0,
  'DROP TABLE `visa_rule_source_authority_events`',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT=''Rollback blocked: source authority governance evidence exists'''
);
PREPARE source_authority_rollback_statement FROM @source_authority_rollback_sql;
EXECUTE source_authority_rollback_statement;
DEALLOCATE PREPARE source_authority_rollback_statement;
