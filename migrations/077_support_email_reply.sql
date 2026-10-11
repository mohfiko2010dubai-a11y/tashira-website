-- Additive: preserves all existing template values and audit events.
ALTER TABLE outbound_email_events
 MODIFY COLUMN email_template ENUM('SUPPORT_REPLY','APPLICATION_RECEIVED','PAYMENT_SUCCESS','PAYMENT_FAILED','DOCUMENTS_REQUIRED','SUBMITTED','STATUS_CHANGED','VISA_ISSUED','RESUME_LINK','RECOVERY_OTP','SECURITY_DEPOSIT_REQUEST','REFUND_COMPLETED','DOCUMENTS_COMPLETE','PRODUCT_SUBSTITUTED','REJECTED','RESUME_REMINDER','REVIEW_REQUEST','APPROVAL_PENDING','GUARANTEE_BREACHED','CONNECTION_BROKEN','SUPPLIER_OVERRIDE','LICENCE_EXPIRY') NOT NULL;

CREATE TABLE operations_support_email_requests (
 command_id varchar(36) NOT NULL PRIMARY KEY,
 thread_id varchar(36) NOT NULL,
 application_id bigint unsigned NOT NULL,
 actor_staff_id bigint unsigned NOT NULL,
 command_sha256 char(64) NOT NULL,
 body text NOT NULL,
 job_key varchar(160) NOT NULL,
 created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY support_email_job_uq(job_key),
 CONSTRAINT support_email_thread_fk FOREIGN KEY(thread_id) REFERENCES operations_support_threads(id) ON DELETE RESTRICT,
 CONSTRAINT support_email_application_fk FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE RESTRICT,
 CONSTRAINT support_email_actor_fk FOREIGN KEY(actor_staff_id) REFERENCES staff_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER support_email_request_no_update BEFORE UPDATE ON operations_support_email_requests FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Support email request is immutable'; END$$
CREATE TRIGGER support_email_request_no_delete BEFORE DELETE ON operations_support_email_requests FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Support email request is immutable'; END$$
DELIMITER ;
