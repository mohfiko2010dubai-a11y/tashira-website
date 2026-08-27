DROP TRIGGER IF EXISTS `operations_submission_policy_event_no_delete`;
DROP TRIGGER IF EXISTS `operations_submission_policy_event_no_update`;
ALTER TABLE `submission_schedule_snapshots`
  MODIFY COLUMN `schedule_state` enum('NOT_EVALUATED','NOT_APPLICABLE','TOO_EARLY','SCHEDULED_FOR_SUBMISSION','SUBMISSION_WINDOW_OPEN','READY_FOR_SUBMISSION','BLOCKED_BY_REQUIREMENTS','BLOCKED_BY_MANUAL_REVIEW','OVERDUE','ALREADY_SUBMITTED','HUMAN_REVIEW_REQUIRED') NOT NULL;
DROP TABLE IF EXISTS `operations_submission_policy_events`;
DROP TABLE IF EXISTS `operations_submission_policies`;
