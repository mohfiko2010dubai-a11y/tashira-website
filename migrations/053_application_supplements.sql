CREATE TABLE application_supplements (
  application_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  additional_notes TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);
CREATE TABLE application_supporting_documents (
  document_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX supporting_application (application_id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
