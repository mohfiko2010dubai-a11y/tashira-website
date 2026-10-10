CREATE TABLE security_deposit_email_attempts (
  request_id varchar(36) NOT NULL PRIMARY KEY,
  encrypted_payload text NULL,
  first_attempt_at datetime NULL,
  lease_id varchar(36) NULL,
  lease_until datetime NULL,
  provider_reference varchar(255) NULL,
  CONSTRAINT deposit_email_request_fk FOREIGN KEY (request_id) REFERENCES security_deposit_requests(id) ON DELETE RESTRICT
);
