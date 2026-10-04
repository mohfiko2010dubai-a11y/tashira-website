ALTER TABLE staff_users
  ADD COLUMN staff_role ENUM('staff','admin') NOT NULL DEFAULT 'staff',
  ADD COLUMN mfa_secret TEXT NULL,
  ADD COLUMN mfa_last_counter BIGINT UNSIGNED NULL;

CREATE TABLE document_access_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  staff_id BIGINT UNSIGNED NOT NULL,
  action ENUM('VIEW','DOWNLOAD') NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX document_access_order (document_id, occurred_at),
  INDEX document_access_person (staff_id, occurred_at)
);

DELIMITER $$
CREATE TRIGGER staff_users_no_delete BEFORE DELETE ON staff_users
FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Deactivate named staff accounts; preserve their audit identity'; END$$
CREATE TRIGGER document_access_events_no_update BEFORE UPDATE ON document_access_events
FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document access history is append-only'; END$$
CREATE TRIGGER document_access_events_no_delete BEFORE DELETE ON document_access_events
FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document access history is append-only'; END$$
DELIMITER ;
