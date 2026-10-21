CREATE TABLE IF NOT EXISTS application_request_hosts (
 application_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 request_host VARCHAR(253) NOT NULL,
 recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_request_host_application FOREIGN KEY(application_id) REFERENCES applications(id)
);

