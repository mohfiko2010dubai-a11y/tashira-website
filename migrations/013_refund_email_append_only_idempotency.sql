ALTER TABLE `outbound_email_events`
  DROP INDEX `outbound_email_template_source_uq`,
  ADD COLUMN `sent_source_reference` varchar(100)
    GENERATED ALWAYS AS (
      CASE WHEN `email_status` = 'SENT' THEN `source_reference` ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY `outbound_email_template_sent_source_uq` (`email_template`, `sent_source_reference`);
