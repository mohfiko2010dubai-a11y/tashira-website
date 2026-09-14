CREATE TABLE stripe_webhook_attempts (
  event_id varchar(255) NOT NULL,
  attempt_number bigint unsigned NOT NULL,
  processing_status enum('processing','processed','failed') NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamp NULL,
  PRIMARY KEY (event_id,attempt_number),
  CONSTRAINT webhook_attempt_event_fk FOREIGN KEY (event_id) REFERENCES stripe_webhook_events(event_id) ON DELETE RESTRICT
);
