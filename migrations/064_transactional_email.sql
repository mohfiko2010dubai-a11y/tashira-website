ALTER TABLE applications
 ADD COLUMN preferred_language ENUM('en','ar') NOT NULL DEFAULT 'en',
 ADD COLUMN email_delivery_issue BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outbound_email_events
 MODIFY COLUMN email_template ENUM('APPLICATION_RECEIVED','PAYMENT_SUCCESS','PAYMENT_FAILED','DOCUMENTS_REQUIRED','SUBMITTED','STATUS_CHANGED','VISA_ISSUED','RESUME_LINK','RECOVERY_OTP','SECURITY_DEPOSIT_REQUEST','REFUND_COMPLETED','DOCUMENTS_COMPLETE','PRODUCT_SUBSTITUTED','REJECTED','RESUME_REMINDER','REVIEW_REQUEST','APPROVAL_PENDING','GUARANTEE_BREACHED','CONNECTION_BROKEN') NOT NULL,
 MODIFY COLUMN email_status ENUM('QUEUED','SENT','FAILED','SUPPRESSED','DELIVERED','BOUNCED') NOT NULL;
CREATE TABLE email_delivery_receipts (
 event_id VARCHAR(100) PRIMARY KEY,
 provider_reference VARCHAR(100) NOT NULL,
 event_type VARCHAR(50) NOT NULL,
 received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE transactional_email_jobs (
 job_key VARCHAR(160) PRIMARY KEY,
 application_id BIGINT UNSIGNED NOT NULL,
 template VARCHAR(50) NOT NULL,
 variables_json JSON NOT NULL,
 job_status ENUM('PENDING','SENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
 attempts INT NOT NULL DEFAULT 0,
 failure_message VARCHAR(255) NULL,
 available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 claimed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX email_jobs_ready(job_status,available_at)
);
CREATE TABLE transactional_email_start (
 singleton TINYINT PRIMARY KEY,
 enabled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO transactional_email_start(singleton) VALUES(1);
DELIMITER $$
CREATE TRIGGER outbound_email_timeline AFTER INSERT ON outbound_email_events FOR EACH ROW
BEGIN
 IF NEW.email_application_id IS NOT NULL THEN
  INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary)
  VALUES(UUID(),NEW.email_application_id,CONCAT('EMAIL_',NEW.email_status),'TRANSACTIONAL_EMAIL','SYSTEM',NEW.email_provider_reference,NEW.email_status,CONCAT(NEW.email_template,': ',NEW.email_status));
  IF NEW.email_status='BOUNCED' THEN
   UPDATE applications SET email_delivery_issue=TRUE WHERE id=NEW.email_application_id;
  END IF;
 END IF;
END$$
CREATE TRIGGER email_delivery_receipts_no_update BEFORE UPDATE ON email_delivery_receipts FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Email receipts are append-only'; END$$
CREATE TRIGGER email_delivery_receipts_no_delete BEFORE DELETE ON email_delivery_receipts FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Email receipts are append-only'; END$$
DELIMITER ;
