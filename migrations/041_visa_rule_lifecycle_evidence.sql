CREATE TABLE IF NOT EXISTS `visa_rule_governance_events` (
  `id` varchar(36) NOT NULL,
  `rule_version_id` varchar(36) NOT NULL,
  `from_status` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','RETIRED','REJECTED') NULL,
  `to_status` enum('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','RETIRED','REJECTED') NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `payload_sha256` varchar(64) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_governance_history_idx` (`rule_version_id`,`occurred_at`,`id`),
  CONSTRAINT `visa_rule_governance_version_fk` FOREIGN KEY (`rule_version_id`) REFERENCES `visa_rule_versions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `visa_rule_governance_event_no_update`
BEFORE UPDATE ON `visa_rule_governance_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa rule governance history is append-only'$$

CREATE TRIGGER `visa_rule_governance_event_no_delete`
BEFORE DELETE ON `visa_rule_governance_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa rule governance history is append-only'$$
DELIMITER ;
