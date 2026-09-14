-- Preserve original snapshots and append every subsequent customer-visible quote.
CREATE TABLE checkout_quote_revisions (
  id varchar(36) NOT NULL PRIMARY KEY,
  application_id bigint unsigned NOT NULL,
  revision bigint unsigned NOT NULL,
  context_hash char(64) NOT NULL,
  quote_json json NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY checkout_quote_application_revision (application_id, revision),
  CONSTRAINT checkout_quote_application_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT
);
DELIMITER $$
CREATE TRIGGER checkout_quote_no_update BEFORE UPDATE ON checkout_quote_revisions FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Checkout quote revisions are append-only'; END$$
CREATE TRIGGER checkout_quote_no_delete BEFORE DELETE ON checkout_quote_revisions FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Checkout quote revisions are append-only'; END$$
DELIMITER ;

-- An already-issued intent retains the exact historical quote on resume.
-- Unstarted applications are deliberately not backfilled: their next read reprices.
INSERT INTO checkout_quote_revisions (id,application_id,revision,context_hash,quote_json)
SELECT UUID(),a.id,1,SHA2(CONCAT('legacy-frozen:',a.id),256),JSON_OBJECT(
  'pricingRuleId',s.pricing_rule_id,'pricingVersion',s.pricing_version,
  'applicantCount',s.applicant_count,'unitPrice',s.unit_price,'totalPrice',s.total_price,
  'supplierCost',s.snapshot_supplier_cost,'internalCost',s.snapshot_internal_cost,
  'markup',s.snapshot_markup,'minimumSellingPrice',s.snapshot_minimum_selling_price,
  'currency',s.snapshot_currency,'exchangeRateToBase',s.exchange_rate_to_base,
  'baseCurrency',s.snapshot_base_currency,'totalInBaseCurrency',s.total_in_base_currency)
FROM applications a JOIN application_price_snapshots s ON s.application_id=a.id
WHERE a.stripe_payment_intent_id IS NOT NULL;

-- All snapshot readers see the latest revision; historical rows remain immutable.
CREATE VIEW current_application_price_snapshots AS
SELECT COALESCE(q.id,s.id) id,a.id application_id,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.pricingRuleId')) AS UNSIGNED),s.pricing_rule_id) pricing_rule_id,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.pricingVersion')) AS UNSIGNED),s.pricing_version) pricing_version,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.applicantCount')) AS UNSIGNED),s.applicant_count) applicant_count,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.unitPrice')) AS DECIMAL(12,2)),s.unit_price) unit_price,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.totalPrice')) AS DECIMAL(12,2)),s.total_price) total_price,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.supplierCost')) AS DECIMAL(12,2)),s.snapshot_supplier_cost) snapshot_supplier_cost,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.internalCost')) AS DECIMAL(12,2)),s.snapshot_internal_cost) snapshot_internal_cost,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.markup')) AS DECIMAL(12,2)),s.snapshot_markup) snapshot_markup,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.minimumSellingPrice')) AS DECIMAL(12,2)),s.snapshot_minimum_selling_price) snapshot_minimum_selling_price,
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.currency')),s.snapshot_currency) snapshot_currency,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.exchangeRateToBase')) AS DECIMAL(14,6)),s.exchange_rate_to_base) exchange_rate_to_base,
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.baseCurrency')),s.snapshot_base_currency) snapshot_base_currency,
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(q.quote_json,'$.totalInBaseCurrency')) AS DECIMAL(12,2)),s.total_in_base_currency) total_in_base_currency,
  COALESCE(q.created_at,s.created_at) created_at
FROM applications a LEFT JOIN application_price_snapshots s ON s.application_id=a.id
LEFT JOIN checkout_quote_revisions q ON q.application_id=a.id
  AND q.revision=(SELECT MAX(q2.revision) FROM checkout_quote_revisions q2 WHERE q2.application_id=a.id)
WHERE q.id IS NOT NULL OR s.id IS NOT NULL;
