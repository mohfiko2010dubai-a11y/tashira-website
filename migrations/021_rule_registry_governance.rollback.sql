-- Recovery: remove only guards introduced by migration 021; no rule evidence is changed.
DROP TRIGGER IF EXISTS `visa_rule_review_no_delete`;
DROP TRIGGER IF EXISTS `visa_rule_review_no_update`;
DROP TRIGGER IF EXISTS `visa_rule_source_snapshot_no_delete`;
DROP TRIGGER IF EXISTS `visa_rule_source_snapshot_no_update`;
DROP TRIGGER IF EXISTS `visa_rule_version_update_guard`;
DROP TRIGGER IF EXISTS `visa_rule_version_insert_guard`;
