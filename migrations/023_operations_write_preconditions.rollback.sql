ALTER TABLE `operations_action_events`
  DROP FOREIGN KEY `operations_action_team_fk`,
  DROP INDEX `operations_action_team_idx`,
  DROP COLUMN `team_id`;
DROP TABLE IF EXISTS `operations_staff_workload_limits`;
DROP TABLE IF EXISTS `operations_document_controls`;
