-- DISPOSABLE STAGING ONLY. This rollback destroys Phase 7 staging data.
-- Never run in production. Take and verify a staging backup before use.

DROP TRIGGER IF EXISTS `document_lifecycle_no_delete`;
DROP TRIGGER IF EXISTS `document_lifecycle_no_update`;
DROP TRIGGER IF EXISTS `outbound_email_no_delete`;
DROP TRIGGER IF EXISTS `outbound_email_no_update`;
DROP TRIGGER IF EXISTS `deletion_audit_no_delete`;
DROP TRIGGER IF EXISTS `deletion_audit_no_update`;
DROP TRIGGER IF EXISTS `legal_hold_events_no_delete`;
DROP TRIGGER IF EXISTS `legal_hold_events_no_update`;
DROP TRIGGER IF EXISTS `risk_assessments_no_delete`;
DROP TRIGGER IF EXISTS `risk_assessments_no_update`;
DROP TRIGGER IF EXISTS `financial_events_no_delete`;
DROP TRIGGER IF EXISTS `financial_events_no_update`;
DROP TRIGGER IF EXISTS `price_snapshot_no_delete`;
DROP TRIGGER IF EXISTS `price_snapshot_no_update`;
DROP TRIGGER IF EXISTS `application_timeline_no_delete`;
DROP TRIGGER IF EXISTS `application_timeline_no_update`;

DROP TABLE IF EXISTS `document_lifecycle_events`;
DROP TABLE IF EXISTS `outbound_email_events`;
DROP TABLE IF EXISTS `customer_recovery_challenges`;
DROP TABLE IF EXISTS `deletion_audit_events`;
DROP TABLE IF EXISTS `legal_hold_events`;
DROP TABLE IF EXISTS `retention_records`;
DROP TABLE IF EXISTS `retention_policies`;
DROP TABLE IF EXISTS `application_risk_assessments`;
DROP TABLE IF EXISTS `financial_events`;
DROP TABLE IF EXISTS `application_price_snapshots`;
DROP TABLE IF EXISTS `business_settings_versions`;
DROP TABLE IF EXISTS `pricing_rules`;
