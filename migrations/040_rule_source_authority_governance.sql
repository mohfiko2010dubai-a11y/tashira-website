CREATE TABLE IF NOT EXISTS `visa_rule_source_authority_events` (
  `id` varchar(36) NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `policy_version` varchar(80) NOT NULL,
  `authority_type` enum('ICP','GDRFA','UAE_GOVERNMENT_PORTAL','OTHER_UAE_GOVERNMENT_AUTHORITY','COMMERCIAL','BLOG','FORUM','SOCIAL_MEDIA') NOT NULL,
  `decision` enum('APPROVED','REJECTED','CHANGES_REQUIRED') NOT NULL,
  `actor_reference` varchar(100) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `occurred_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `visa_rule_source_authority_history_idx` (`source_id`,`occurred_at`,`id`),
  CONSTRAINT `visa_rule_source_authority_source_fk` FOREIGN KEY (`source_id`) REFERENCES `visa_rule_sources` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER `visa_rule_source_authority_event_no_update`
BEFORE UPDATE ON `visa_rule_source_authority_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rule source authority history is append-only'$$

CREATE TRIGGER `visa_rule_source_authority_event_no_delete`
BEFORE DELETE ON `visa_rule_source_authority_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rule source authority history is append-only'$$
DELIMITER ;
