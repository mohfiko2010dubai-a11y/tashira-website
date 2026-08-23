-- Recovery only. Back up action/audit evidence before using this rollback.
DROP TRIGGER IF EXISTS `operations_idempotency_no_delete`;
DROP TRIGGER IF EXISTS `operations_idempotency_no_update`;
DROP TRIGGER IF EXISTS `operations_action_events_no_delete`;
DROP TRIGGER IF EXISTS `operations_action_events_no_update`;
DROP TABLE IF EXISTS `operations_idempotency_records`;
DROP TABLE IF EXISTS `operations_action_events`;
DROP TABLE IF EXISTS `operations_case_controls`;
