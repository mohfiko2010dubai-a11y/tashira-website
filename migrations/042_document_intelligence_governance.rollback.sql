SET @document_intelligence_evidence_count := (
  (SELECT COUNT(*) FROM `applicant_field_selection_events`) +
  (SELECT COUNT(*) FROM `document_field_evidence`) +
  (SELECT COUNT(*) FROM `document_intelligence_runs`) +
  (SELECT COUNT(*) FROM `document_intelligence_governance_events`) +
  (SELECT COUNT(*) FROM `passport_profile_versions`) +
  (SELECT COUNT(*) FROM `authority_application_field_requirements`)
);
SET @document_intelligence_rollback_sql := IF(
  @document_intelligence_evidence_count = 0,
  'SET @document_intelligence_rollback_allowed := 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT=''Rollback blocked: document intelligence evidence exists'''
);
PREPARE document_intelligence_rollback_statement FROM @document_intelligence_rollback_sql;
EXECUTE document_intelligence_rollback_statement;
DEALLOCATE PREPARE document_intelligence_rollback_statement;

DROP TRIGGER IF EXISTS `applicant_field_selection_no_delete`;
DROP TRIGGER IF EXISTS `applicant_field_selection_no_update`;
DROP TRIGGER IF EXISTS `document_field_evidence_no_delete`;
DROP TRIGGER IF EXISTS `document_field_evidence_no_update`;
DROP TRIGGER IF EXISTS `document_intelligence_run_no_delete`;
DROP TRIGGER IF EXISTS `document_intelligence_run_no_update`;
DROP TRIGGER IF EXISTS `document_intelligence_governance_no_delete`;
DROP TRIGGER IF EXISTS `document_intelligence_governance_no_update`;
DROP TRIGGER IF EXISTS `passport_profile_version_no_delete`;
DROP TRIGGER IF EXISTS `passport_profile_version_no_update`;
DROP TRIGGER IF EXISTS `authority_field_requirement_no_delete`;
DROP TRIGGER IF EXISTS `authority_field_requirement_no_update`;

DROP TABLE `applicant_field_selection_events`;
DROP TABLE `document_field_evidence`;
DROP TABLE `document_intelligence_runs`;
DROP TABLE `document_intelligence_governance_events`;
DROP TABLE `passport_profile_versions`;
DROP TABLE `authority_application_field_requirements`;
