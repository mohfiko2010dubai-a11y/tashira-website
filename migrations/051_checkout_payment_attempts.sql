ALTER TABLE payments ADD UNIQUE KEY payment_stripe_intent_unique (stripe_payment_intent_id);
CREATE TABLE checkout_payment_attempts (
  application_id bigint unsigned NOT NULL PRIMARY KEY,
  idempotency_key char(36) NOT NULL,
  quote_id varchar(36) NOT NULL,
  first_requested_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stripe_payment_intent_id varchar(100) NULL,
  UNIQUE KEY checkout_attempt_key (idempotency_key),
  UNIQUE KEY checkout_attempt_intent (stripe_payment_intent_id),
  CONSTRAINT checkout_attempt_application_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT checkout_attempt_quote_fk FOREIGN KEY (quote_id) REFERENCES checkout_quote_revisions(id) ON DELETE RESTRICT
);
