-- No existing order is classified by this migration. Owner review is required per record.
ALTER TABLE applications ADD COLUMN is_test boolean NOT NULL DEFAULT false;
CREATE INDEX application_test_created ON applications (is_test, created_at);
