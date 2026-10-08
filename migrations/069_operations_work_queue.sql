-- Existing case controls remain the sole assignment authority.
-- Shared queue exposes counts only until an atomic claim grants assigned access.
CREATE TABLE operations_work_dispatch_lock (
  id tinyint unsigned NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO operations_work_dispatch_lock (id) VALUES (1);

CREATE TABLE operations_staff_availability (
  staff_user_id bigint unsigned NOT NULL PRIMARY KEY,
  availability enum('AVAILABLE','BREAK','OFF_DUTY') NOT NULL DEFAULT 'OFF_DUTY',
  changed_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT work_availability_staff_fk FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE operations_case_work (
  application_id bigint unsigned NOT NULL PRIMARY KEY,
  work_state enum('READY','ACTIVE','WAIT_CUSTOMER','WAIT_AUTHORITY','WAIT_SUPPLIER','DONE') NOT NULL DEFAULT 'READY',
  version bigint unsigned NOT NULL DEFAULT 0,
  reason varchar(500) NOT NULL,
  follow_up_at datetime(3) NULL,
  changed_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY work_follow_up_idx (work_state,follow_up_at),
  CONSTRAINT work_case_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE operations_work_events (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_user_id bigint unsigned NOT NULL,
  application_id bigint unsigned NULL,
  event_type enum('AVAILABILITY','CLAIM','WORK_STATE') NOT NULL,
  previous_state varchar(24) NULL,
  next_state varchar(24) NOT NULL,
  reason varchar(500) NOT NULL,
  follow_up_at datetime(3) NULL,
  idempotency_key varchar(100) NOT NULL,
  command_hash char(64) NOT NULL,
  result_json json NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY work_event_retry_uq (staff_user_id,idempotency_key),
  KEY work_event_staff_idx (staff_user_id,created_at),
  KEY work_event_case_idx (application_id,created_at),
  CONSTRAINT work_event_staff_fk FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE RESTRICT,
  CONSTRAINT work_event_case_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER work_events_no_update BEFORE UPDATE ON operations_work_events FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Work history is append-only'; END$$
CREATE TRIGGER work_events_no_delete BEFORE DELETE ON operations_work_events FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Work history is append-only'; END$$
DELIMITER ;
