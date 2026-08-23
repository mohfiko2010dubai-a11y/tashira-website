-- Recovery removes only migration 022 guards/index/column. It does not rewrite Rule evidence.
DROP TRIGGER IF EXISTS `visa_rule_version_layer_update_guard`;
DROP TRIGGER IF EXISTS `visa_rule_version_layer_insert_guard`;
ALTER TABLE `visa_rule_versions`
  DROP INDEX `visa_rule_version_layer_idx`,
  DROP COLUMN `rule_layer`;
