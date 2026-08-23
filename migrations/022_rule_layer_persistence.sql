-- Purpose: persist the authoritative eligibility precedence layer on immutable Rule Versions.
-- Existing records are intentionally left NULL because no reliable historical backfill exists.
-- A legacy version without a layer cannot be newly inserted, approved/activated, or evaluated.

ALTER TABLE `visa_rule_versions`
  ADD COLUMN `rule_layer` enum(
    'BASE_ROUTE','NATIONALITY_OVERLAY','RESIDENCE_OVERLAY','GCC_OVERLAY',
    'AGE_MINOR_OVERLAY','FAMILY_OVERLAY','OPERATIONAL_OVERLAY'
  ) NULL AFTER `classification`,
  ADD KEY `visa_rule_version_layer_idx` (`rule_layer`,`status`,`effective_from`,`effective_to`);

DELIMITER $$
CREATE TRIGGER `visa_rule_version_layer_insert_guard` BEFORE INSERT ON `visa_rule_versions` FOR EACH ROW
BEGIN
  IF NEW.`rule_layer` IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule layer is required for new Rule Versions';
  END IF;
END$$
CREATE TRIGGER `visa_rule_version_layer_update_guard` BEFORE UPDATE ON `visa_rule_versions` FOR EACH ROW
BEGIN
  IF NOT (NEW.`rule_layer` <=> OLD.`rule_layer`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule layer evidence is immutable';
  END IF;
  IF NEW.`status` IN ('APPROVED','ACTIVE') AND NEW.`rule_layer` IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Legacy Rule Version without a layer cannot be approved or activated';
  END IF;
END$$
DELIMITER ;
