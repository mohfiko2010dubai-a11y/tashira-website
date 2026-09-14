ALTER TABLE applications ADD COLUMN stripe_event_created bigint unsigned NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN stripe_event_created bigint unsigned NOT NULL DEFAULT 0;
