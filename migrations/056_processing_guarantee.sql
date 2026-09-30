-- No inferred historic timestamps and no rewriting of paid quotes.
CREATE TABLE IF NOT EXISTS application_service_clocks (
  application_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  documents_completed_at DATETIME(3) NULL,
  authority_submitted_at DATETIME(3) NULL,
  submission_actor VARCHAR(100) NULL,
  express_refund_case_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT service_clock_application_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT service_clock_refund_fk FOREIGN KEY (express_refund_case_id) REFERENCES refund_cases(id) ON DELETE RESTRICT
);
