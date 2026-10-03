ALTER TABLE nationality_availability_config ADD COLUMN product_rules JSON NULL;
ALTER TABLE nationality_availability_audit ADD COLUMN product_rules JSON NULL;
-- NULL on an old version means no additional product-specific restrictions.
-- Existing all-product restrictions remain effective without policy invention.
UPDATE nationality_availability_config SET
  unavailable_codes=JSON_ARRAY('IR','SS','UG','CD','BD'),
  product_rules=JSON_ARRAY(
    JSON_OBJECT('nationality','SD','product','14days-multiple','from','2026-10-04T00:00:00Z','until',NULL),
    JSON_OBJECT('nationality','SD','product','30days-multiple','from','2026-10-04T00:00:00Z','until',NULL),
    JSON_OBJECT('nationality','SD','product','60days-multiple','from','2026-10-04T00:00:00Z','until',NULL)
  ), version=version+1,updated_at=NOW(3) WHERE id=1;
INSERT INTO nationality_availability_audit (unavailable_codes,product_rules,actor)
  SELECT unavailable_codes,product_rules,'OWNER_TASK25_APPROVED_SEED' FROM nationality_availability_config WHERE id=1;
