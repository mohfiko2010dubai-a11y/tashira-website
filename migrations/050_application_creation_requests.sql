CREATE TABLE application_creation_devices (
  owner_hash char(64) NOT NULL PRIMARY KEY
);
CREATE TABLE application_creation_requests (
  id char(36) NOT NULL PRIMARY KEY,
  sequence bigint unsigned NOT NULL AUTO_INCREMENT,
  owner_hash char(64) NOT NULL,
  flow enum('FORM','CHAT','LEGACY') NOT NULL,
  reference_number varchar(50) NOT NULL,
  application_id bigint unsigned NULL,
  payload_hash char(64) NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY creation_sequence (sequence),
  UNIQUE KEY creation_reference (reference_number),
  UNIQUE KEY creation_application (application_id),
  KEY creation_owner_flow (owner_hash,flow,sequence),
  CONSTRAINT creation_owner_fk FOREIGN KEY (owner_hash) REFERENCES application_creation_devices(owner_hash) ON DELETE RESTRICT,
  CONSTRAINT creation_application_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
);
