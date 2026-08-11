-- Prevent concurrent wizard requests from creating two applicants in one application slot.
-- This migration deliberately stops if legacy duplicates exist; duplicates require a reviewed
-- data-resolution decision and must never be deleted or merged automatically.

SET @applicant_slot_duplicates = (
  SELECT COUNT(*)
  FROM (
    SELECT `application_id`, `applicant_index`
    FROM `applicants`
    GROUP BY `application_id`, `applicant_index`
    HAVING COUNT(*) > 1
  ) AS duplicate_slots
);

SET @applicant_slot_index_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`statistics`
  WHERE `table_schema` = DATABASE()
    AND `table_name` = 'applicants'
    AND `index_name` = 'applicant_application_index_uq'
);

SET @applicant_slot_statement = IF(
  @applicant_slot_index_exists > 0,
  'SELECT 1',
  IF(
    @applicant_slot_duplicates > 0,
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Duplicate applicant slots require reviewed resolution''',
    'ALTER TABLE `applicants` ADD CONSTRAINT `applicant_application_index_uq` UNIQUE (`application_id`, `applicant_index`)'
  )
);

PREPARE applicant_slot_migration FROM @applicant_slot_statement;
EXECUTE applicant_slot_migration;
DEALLOCATE PREPARE applicant_slot_migration;
