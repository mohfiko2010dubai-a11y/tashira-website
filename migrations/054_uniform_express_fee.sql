-- Owner approval, 2026-09-15: Express is USD 30 per traveller for every visa.
-- Seven products already have that delta. The 14-day single-entry product is
-- the sole exception (regular USD 170, Express USD 195). Append its new price;
-- never rewrite historical pricing rules, snapshots, quotes or payment intents.
INSERT INTO pricing_rules (
  service_code, pricing_processing_type, version, supplier_cost, internal_cost,
  markup, selling_price, promotional_price, minimum_selling_price,
  pricing_currency, effective_at, expires_at, created_by
)
SELECT e.service_code, e.pricing_processing_type, 2, e.supplier_cost, e.internal_cost,
  200.00 - e.supplier_cost - e.internal_cost, 200.00, NULL, e.minimum_selling_price,
  'USD', NOW(), NULL, 'owner:task17-uniform-express-30'
FROM pricing_rules e
WHERE e.service_code = '14days-single'
  AND e.pricing_processing_type = 'express' AND e.version = 1
  AND e.selling_price = 195.00 AND e.promotional_price IS NULL
  AND e.pricing_currency = 'USD'
  AND NOT EXISTS (
    SELECT 1 FROM pricing_rules newer
    WHERE newer.service_code = e.service_code
      AND newer.pricing_processing_type = e.pricing_processing_type
      AND newer.version > e.version
  );
