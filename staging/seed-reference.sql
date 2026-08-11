-- Synthetic staging reference data only. Not legal, tax, or production configuration.
-- Safe to rerun: fixed version keys prevent duplicate reference rows.

INSERT IGNORE INTO `business_settings_versions` (
  `settings_version`, `legal_name`, `company_address`, `company_phone`, `company_email`,
  `vat_registered`, `trn`, `settings_vat_rate`, `vat_effective_at`, `registration_threshold`,
  `warning_levels_json`, `invoice_prefix`, `next_invoice_number`, `base_currency`,
  `usd_to_base_rate`, `settings_effective_at`, `settings_created_by`
) VALUES (
  1, 'TASHIRA STAGING TEST ENTITY - NOT LEGAL', 'SYNTHETIC STAGING ADDRESS', '+0000000000',
  'staging@example.invalid', 'no', NULL, 0.0000, NULL, 100000.00,
  '[70,80,90,95,100]', 'STG', 1, 'AED', 3.670000, '2026-01-01 00:00:00', 'staging-seed'
);

INSERT IGNORE INTO `pricing_rules` (
  `service_code`, `pricing_processing_type`, `version`, `supplier_cost`, `internal_cost`,
  `markup`, `selling_price`, `promotional_price`, `minimum_selling_price`, `pricing_currency`,
  `effective_at`, `expires_at`, `created_by`
) VALUES
  ('14days-single','regular',1,100.00,10.00,55.00,165.00,NULL,150.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('14days-single','express',1,110.00,10.00,75.00,195.00,NULL,175.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('30days-single','regular',1,115.00,10.00,60.00,185.00,NULL,165.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('30days-single','express',1,125.00,10.00,80.00,215.00,NULL,195.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('60days-single','regular',1,200.00,15.00,80.00,295.00,NULL,270.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('60days-single','express',1,215.00,15.00,95.00,325.00,NULL,300.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('90days-single','regular',1,400.00,20.00,130.00,550.00,NULL,500.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('90days-single','express',1,420.00,20.00,140.00,580.00,NULL,530.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('30days-multiple','regular',1,200.00,15.00,70.00,285.00,NULL,260.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('30days-multiple','express',1,215.00,15.00,85.00,315.00,NULL,290.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('60days-multiple','regular',1,285.00,15.00,85.00,385.00,NULL,350.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('60days-multiple','express',1,300.00,15.00,100.00,415.00,NULL,380.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('96hours-transit','regular',1,90.00,10.00,45.00,145.00,NULL,130.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed'),
  ('96hours-transit','express',1,105.00,10.00,60.00,175.00,NULL,160.00,'USD','2026-01-01 00:00:00',NULL,'staging-seed');
