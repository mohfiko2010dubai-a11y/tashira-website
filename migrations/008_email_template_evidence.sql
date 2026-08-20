-- Keep append-only outbound email evidence aligned with supported templates.
-- Apply only through the approved staging migration process.
ALTER TABLE `outbound_email_events`
  MODIFY COLUMN `email_template` enum(
    'APPLICATION_RECEIVED',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'DOCUMENTS_REQUIRED',
    'SUBMITTED',
    'STATUS_CHANGED',
    'VISA_ISSUED',
    'RESUME_LINK',
    'RECOVERY_OTP'
  ) NOT NULL;
