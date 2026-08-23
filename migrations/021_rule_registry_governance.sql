-- Purpose: enforce minimal Rule Registry governance and evidence immutability.
-- This migration adds guards only; it does not activate, rewrite, or backfill any rule.
DELIMITER $$
CREATE TRIGGER `visa_rule_version_insert_guard` BEFORE INSERT ON `visa_rule_versions` FOR EACH ROW
BEGIN
  IF NEW.`status` = 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule versions cannot be imported directly as ACTIVE';
  END IF;
END$$
CREATE TRIGGER `visa_rule_version_update_guard` BEFORE UPDATE ON `visa_rule_versions` FOR EACH ROW
BEGIN
  IF NOT (
    NEW.`rule_set_id` <=> OLD.`rule_set_id` AND NEW.`version` <=> OLD.`version`
    AND NEW.`classification` <=> OLD.`classification` AND NEW.`research_status` <=> OLD.`research_status`
    AND NEW.`source_snapshot_id` <=> OLD.`source_snapshot_id` AND NEW.`effective_from` <=> OLD.`effective_from`
    AND NEW.`conditions_json` <=> OLD.`conditions_json` AND NEW.`outcome_json` <=> OLD.`outcome_json`
    AND NEW.`created_by` <=> OLD.`created_by` AND NEW.`created_at` <=> OLD.`created_at`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule version evidence is immutable';
  END IF;
  IF NEW.`status` = 'ACTIVE' AND OLD.`status` <> 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM `visa_rule_reviews` WHERE `rule_version_id` = OLD.`id` AND `decision` = 'APPROVED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approved rule review is required before activation';
  END IF;
END$$
CREATE TRIGGER `visa_rule_source_snapshot_no_update` BEFORE UPDATE ON `visa_rule_source_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule source snapshots are append-only'; END$$
CREATE TRIGGER `visa_rule_source_snapshot_no_delete` BEFORE DELETE ON `visa_rule_source_snapshots` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule source snapshots are append-only'; END$$
CREATE TRIGGER `visa_rule_review_no_update` BEFORE UPDATE ON `visa_rule_reviews` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule reviews are append-only'; END$$
CREATE TRIGGER `visa_rule_review_no_delete` BEFORE DELETE ON `visa_rule_reviews` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rule reviews are append-only'; END$$
DELIMITER ;
