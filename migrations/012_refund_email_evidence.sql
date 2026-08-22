ALTER TABLE `outbound_email_events`
  MODIFY COLUMN `email_template` enum(
    'APPLICATION_RECEIVED','PAYMENT_SUCCESS','PAYMENT_FAILED','DOCUMENTS_REQUIRED',
    'SUBMITTED','STATUS_CHANGED','VISA_ISSUED','RESUME_LINK','RECOVERY_OTP',
    'SECURITY_DEPOSIT_REQUEST','REFUND_COMPLETED'
  ) NOT NULL,
  ADD COLUMN `source_reference` varchar(100) NULL AFTER `email_template`,
  ADD UNIQUE KEY `outbound_email_template_source_uq` (`email_template`, `source_reference`);
