CREATE TABLE IF NOT EXISTS nationality_availability_config (
  id TINYINT PRIMARY KEY,
  unavailable_codes JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS nationality_availability_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  unavailable_codes JSON NOT NULL,
  actor VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
-- Owner-approved starting configuration, not an assertion of authority policy.
INSERT IGNORE INTO nationality_availability_config (id,unavailable_codes) VALUES (1,JSON_ARRAY('IR','SS','UG','CD'));
