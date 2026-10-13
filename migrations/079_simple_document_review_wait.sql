-- A single case-level missing-document request pauses the clock only after
-- provider acceptance. Late mail must not reopen a resolved request.
DELIMITER $$
CREATE TRIGGER customer_wait_review_email_sent AFTER INSERT ON outbound_email_events FOR EACH ROW
BEGIN
 IF NEW.email_status='SENT' AND NEW.email_template='DOCUMENTS_REQUIRED'
 AND EXISTS(SELECT 1 FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND NEW.created_at>=enabled_at) THEN
  INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
  SELECT SHA2(CONCAT('review-sent:',r.id),256),r.application_id,CONCAT('review:',r.id),'PAUSE','DOCUMENTS_REQUESTED',NEW.created_at,NEW.id,'SYSTEM:EMAIL_SENT'
  FROM operations_action_events r WHERE r.application_id=NEW.email_application_id AND r.action_type='HUMAN_REVIEW' AND r.outcome='NEEDS_CORRECTION'
   AND NEW.source_reference=SHA2(CONCAT(r.application_id,':application-status:',r.id),256)
   AND NOT EXISTS(SELECT 1 FROM operations_action_events newer WHERE newer.application_id=r.application_id AND newer.action_type='HUMAN_REVIEW' AND newer.entity_version_after>r.entity_version_after)
   AND NOT EXISTS(SELECT 1 FROM document_lifecycle_events d WHERE d.document_event_application_id=r.application_id AND d.created_at>r.created_at AND d.document_lifecycle_event_type IN ('UPLOADED','REPLACED'));
 END IF;
END$$
CREATE TRIGGER customer_wait_review_upload AFTER INSERT ON document_lifecycle_events FOR EACH ROW
BEGIN
 IF NEW.document_lifecycle_event_type IN ('UPLOADED','REPLACED') THEN
  INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
  SELECT SHA2(CONCAT('review-upload:',p.id,':',NEW.id),256),p.application_id,p.wait_key,'RESUME','DOCUMENTS_REQUESTED',NEW.created_at,NEW.id,COALESCE(NEW.document_event_actor_reference,NEW.document_event_actor_type)
  FROM customer_wait_events p WHERE p.application_id=NEW.document_event_application_id AND p.wait_key LIKE 'review:%' AND p.event_kind='PAUSE' AND p.occurred_at<=NEW.created_at;
 END IF;
END$$
DELIMITER ;
