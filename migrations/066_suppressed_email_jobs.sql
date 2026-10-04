-- A stale proposal or completed reminder is not a successful delivery.
ALTER TABLE transactional_email_jobs
 MODIFY COLUMN job_status ENUM('PENDING','SENDING','SENT','FAILED','SUPPRESSED') NOT NULL DEFAULT 'PENDING';
