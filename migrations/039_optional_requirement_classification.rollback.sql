-- Rollback is valid only when no OPTIONAL evidence has been written.
SET @optional_count =
  (SELECT COUNT(*) FROM `requirement_definitions` WHERE `classification`='OPTIONAL') +
  (SELECT COUNT(*) FROM `requirement_question_definitions` WHERE `classification`='OPTIONAL') +
  (SELECT COUNT(*) FROM `applicant_requirement_instances` WHERE `classification`='OPTIONAL');
SET @rollback_sql = IF(@optional_count=0,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Cannot remove OPTIONAL classification while evidence exists''');
PREPARE rollback_guard FROM @rollback_sql;
EXECUTE rollback_guard;
DEALLOCATE PREPARE rollback_guard;

ALTER TABLE `applicant_requirement_instances`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NULL;
ALTER TABLE `requirement_question_definitions`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL;
ALTER TABLE `requirement_definitions`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','INTERNAL') NOT NULL;
