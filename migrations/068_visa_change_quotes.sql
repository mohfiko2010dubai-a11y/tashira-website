-- Immutable price proposal, separate from the original sale and invoice.
CREATE TABLE visa_change_quotes (
 id CHAR(36) NOT NULL PRIMARY KEY,
 application_id BIGINT UNSIGNED NOT NULL,
 version INT NOT NULL,
 previous_product VARCHAR(80) NOT NULL,
 replacement_product VARCHAR(80) NOT NULL,
 old_total_minor BIGINT NOT NULL,
 new_total_minor BIGINT NOT NULL,
 difference_minor BIGINT NOT NULL,
 currency CHAR(3) NOT NULL,
 quote_json JSON NOT NULL,
 payment_id BIGINT UNSIGNED NULL,
 refund_case_id CHAR(36) NULL,
 state ENUM('PROPOSED','ACCEPTED','PAYMENT_PENDING','REFUND_PENDING','SETTLED','SUPERSEDED','REFUSED') NOT NULL DEFAULT 'PROPOSED',
 accepted_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY visa_change_version (application_id,version),
 UNIQUE KEY visa_change_identity (id,application_id,version),
 UNIQUE KEY visa_change_payment (payment_id),
 UNIQUE KEY visa_change_refund (refund_case_id),
 CONSTRAINT visa_change_payment_fk FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_application FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_amounts CHECK(old_total_minor>=0 AND new_total_minor>=0 AND difference_minor=new_total_minor-old_total_minor),
 CONSTRAINT visa_change_currency CHECK(currency='USD')
) ENGINE=InnoDB;

CREATE TABLE visa_change_decisions (
 id CHAR(36) NOT NULL PRIMARY KEY,
 application_id BIGINT UNSIGNED NOT NULL,
 quote_id CHAR(36) NOT NULL,
 quote_version INT NOT NULL,
 kind ENUM('SETTLEMENT','REFUSAL_OUTCOME') NOT NULL,
 outcome ENUM('FULL_REFUND_CANCEL','REFUND_LESS_FEE','TRY_ANOTHER_PRODUCT','ORIGINAL_AT_CUSTOMER_REQUEST') NULL,
 direction ENUM('TOP_UP','REFUND') NULL,
 amount_minor BIGINT NULL,
 currency CHAR(3) NULL,
 stripe_reference VARCHAR(150) NULL,
 reason VARCHAR(500) NOT NULL,
 written_insistence VARCHAR(1000) NULL,
 risk_record VARCHAR(1000) NULL,
 state ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
 requested_by BIGINT UNSIGNED NOT NULL,
 decided_by BIGINT UNSIGNED NULL,
 decision_reason VARCHAR(500) NULL,
 decided_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 approved_stripe_reference VARCHAR(150) GENERATED ALWAYS AS (CASE WHEN state='APPROVED' THEN stripe_reference ELSE NULL END) STORED,
 UNIQUE KEY visa_change_settlement_reference(approved_stripe_reference),
 INDEX visa_change_decision_queue(state,created_at),
 CONSTRAINT visa_change_decision_quote FOREIGN KEY(quote_id,application_id,quote_version) REFERENCES visa_change_quotes(id,application_id,version) ON DELETE RESTRICT,
 CONSTRAINT visa_change_decision_requester FOREIGN KEY(requested_by) REFERENCES staff_users(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_decision_approver FOREIGN KEY(decided_by) REFERENCES staff_users(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_settlement_required CHECK(kind<>'SETTLEMENT' OR (direction IS NOT NULL AND amount_minor>0 AND currency='USD' AND stripe_reference IS NOT NULL AND CHAR_LENGTH(TRIM(stripe_reference))>0)),
 CONSTRAINT visa_change_outcome_required CHECK(kind<>'REFUSAL_OUTCOME' OR outcome IS NOT NULL)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER visa_change_quote_immutable BEFORE UPDATE ON visa_change_quotes
FOR EACH ROW
BEGIN
 IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.application_id <=> OLD.application_id)
 OR NOT (NEW.version <=> OLD.version) OR NOT (NEW.previous_product <=> OLD.previous_product)
 OR NOT (NEW.replacement_product <=> OLD.replacement_product)
 OR NOT (NEW.old_total_minor <=> OLD.old_total_minor) OR NOT (NEW.new_total_minor <=> OLD.new_total_minor)
 OR NOT (NEW.difference_minor <=> OLD.difference_minor) OR NOT (NEW.currency <=> OLD.currency)
 OR NOT (NEW.quote_json <=> OLD.quote_json) OR NOT (NEW.created_at <=> OLD.created_at)
 OR (OLD.payment_id IS NOT NULL AND NOT (NEW.payment_id <=> OLD.payment_id))
 OR (OLD.refund_case_id IS NOT NULL AND NOT (NEW.refund_case_id <=> OLD.refund_case_id))
 OR (OLD.accepted_at IS NOT NULL AND NOT (NEW.accepted_at <=> OLD.accepted_at)) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa-change quote evidence is immutable';
 END IF;
 IF NEW.state<>OLD.state AND NOT (
   (OLD.state='PROPOSED' AND NEW.state IN ('ACCEPTED','SUPERSEDED','REFUSED')) OR
   (OLD.state='PROPOSED' AND NEW.state='SETTLED' AND NEW.difference_minor=0 AND NEW.accepted_at IS NOT NULL) OR
   (OLD.state='ACCEPTED' AND NEW.state='PAYMENT_PENDING' AND NEW.difference_minor>0) OR
   (OLD.state='ACCEPTED' AND NEW.state='REFUND_PENDING' AND NEW.difference_minor<0) OR
   (OLD.state IN ('ACCEPTED','PAYMENT_PENDING','REFUND_PENDING') AND NEW.state='SETTLED' AND EXISTS(SELECT 1 FROM visa_change_decisions d WHERE d.quote_id=NEW.id AND d.kind='SETTLEMENT' AND d.state='APPROVED' AND d.stripe_reference<>'' AND d.amount_minor=ABS(NEW.difference_minor) AND d.currency=NEW.currency AND d.direction=IF(NEW.difference_minor>0,'TOP_UP','REFUND')))
 ) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid visa-change settlement transition';
 END IF;
END$$
CREATE TRIGGER visa_change_quote_no_delete BEFORE DELETE ON visa_change_quotes
FOR EACH ROW BEGIN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Visa-change quote evidence cannot be deleted';
END$$
CREATE TRIGGER visa_change_settlement_filing_guard BEFORE UPDATE ON applications
FOR EACH ROW BEGIN
 IF NEW.status IN ('visa_processing','visa_received','completed') AND
 EXISTS(SELECT 1 FROM visa_change_quotes q WHERE q.application_id=NEW.id
   AND q.version=NEW.substitution_version AND q.state<>'SETTLED'
   AND NOT(q.state='REFUSED' AND NEW.submitted_product=q.previous_product AND EXISTS(SELECT 1 FROM visa_change_decisions d WHERE d.quote_id=q.id AND d.state='APPROVED' AND d.outcome='ORIGINAL_AT_CUSTOMER_REQUEST' AND CHAR_LENGTH(TRIM(d.written_insistence))>0 AND CHAR_LENGTH(TRIM(d.risk_record))>0))) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Settle the accepted visa-change difference before filing';
 END IF;
END$$
DELIMITER ;


-- Activation is explicit at deployment; never backfill customer-held time.
CREATE TABLE customer_wait_policy (
 singleton TINYINT NOT NULL PRIMARY KEY,
 enabled_at DATETIME(3) NULL,
 overdue_hours INT NOT NULL DEFAULT 24,
 CONSTRAINT customer_wait_singleton CHECK(singleton=1),
 CONSTRAINT customer_wait_threshold CHECK(overdue_hours BETWEEN 1 AND 720)
) ENGINE=InnoDB;
INSERT INTO customer_wait_policy(singleton) VALUES(1);
CREATE TABLE customer_wait_events (
 id CHAR(64) NOT NULL PRIMARY KEY,
 application_id BIGINT UNSIGNED NOT NULL,
 wait_key VARCHAR(100) NOT NULL,
 event_kind ENUM('PAUSE','RESUME') NOT NULL,
 reason ENUM('DOCUMENTS_REQUESTED','AMENDMENT_SENT','PAYMENT_LINK_ISSUED','REFUSAL_PENDING_OUTCOME') NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 source_reference VARCHAR(100) NOT NULL,
 actor_reference VARCHAR(100) NOT NULL,
 INDEX customer_wait_owner(application_id,wait_key,occurred_at),
 CONSTRAINT customer_wait_owner_fk FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER customer_wait_no_update BEFORE UPDATE ON customer_wait_events FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Customer wait events are append-only'; END$$
CREATE TRIGGER customer_wait_no_delete BEFORE DELETE ON customer_wait_events FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Customer wait events are append-only'; END$$
CREATE TRIGGER customer_wait_timeline AFTER INSERT ON customer_wait_events FOR EACH ROW
BEGIN
 INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary,created_at)
 VALUES(UUID(),NEW.application_id,CONCAT('CUSTOMER_WAIT_',NEW.event_kind),'SERVICE_CLOCK','SYSTEM',NEW.actor_reference,NEW.event_kind,
 CONCAT(NEW.reason,': ',NEW.wait_key),NEW.occurred_at);
END$$
CREATE TRIGGER customer_wait_email_sent AFTER INSERT ON outbound_email_events FOR EACH ROW
BEGIN
 IF NEW.email_status='SENT' AND EXISTS(SELECT 1 FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND NEW.created_at>=enabled_at) THEN
  IF NEW.email_template='PRODUCT_SUBSTITUTED' THEN
   INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
   SELECT SHA2(CONCAT('quote-sent:',q.id),256),q.application_id,CONCAT('quote:',q.id),'PAUSE','AMENDMENT_SENT',NEW.created_at,NEW.id,'SYSTEM:EMAIL_SENT'
   FROM visa_change_quotes q WHERE q.application_id=NEW.email_application_id
   AND NEW.source_reference=SHA2(CONCAT(q.application_id,':substitution:',q.application_id,':',q.version),256);
  ELSEIF NEW.email_template='DOCUMENTS_REQUIRED' THEN
   INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
   SELECT SHA2(CONCAT('document-sent:',e.id),256),e.document_event_application_id,CONCAT('document:',e.id),'PAUSE','DOCUMENTS_REQUESTED',NEW.created_at,NEW.id,'SYSTEM:EMAIL_SENT'
   FROM document_lifecycle_events e WHERE e.document_event_application_id=NEW.email_application_id AND e.document_lifecycle_event_type='REPLACEMENT_REQUESTED' AND e.document_event_actor_type IN ('STAFF','ADMIN')
   AND NEW.source_reference=SHA2(CONCAT(e.document_event_application_id,':document-event:',e.id),256);
  END IF;
 END IF;
END$$
CREATE TRIGGER customer_wait_document_response AFTER INSERT ON document_lifecycle_events FOR EACH ROW
BEGIN
 IF NEW.document_lifecycle_event_type IN ('UPLOADED','REPLACED','VALIDATED')
 AND EXISTS(SELECT 1 FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND NEW.created_at>=enabled_at) THEN
  INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
  SELECT SHA2(CONCAT('document-response:',e.id,':',NEW.id),256),NEW.document_event_application_id,CONCAT('document:',e.id),'RESUME','DOCUMENTS_REQUESTED',NEW.created_at,NEW.id,
  COALESCE(NEW.document_event_actor_reference,NEW.document_event_actor_type)
  FROM document_lifecycle_events e WHERE e.document_event_application_id=NEW.document_event_application_id
  AND e.document_lifecycle_event_type='REPLACEMENT_REQUESTED' AND e.created_at<=NEW.created_at
  AND (e.document_event_document_id=NEW.replaces_document_id OR e.document_event_document_id=NEW.document_event_document_id);
 END IF;
END$$
CREATE TRIGGER customer_wait_quote_response AFTER INSERT ON product_substitution_events FOR EACH ROW
BEGIN
 IF NEW.action IN ('ACKNOWLEDGED','SETTLED','REFUSAL_RESOLVED')
 AND EXISTS(SELECT 1 FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND NEW.occurred_at>=enabled_at) THEN
  INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
  SELECT SHA2(CONCAT('quote-response:',q.id,':',NEW.id),256),q.application_id,CONCAT('quote:',q.id),'RESUME','AMENDMENT_SENT',NEW.occurred_at,CONCAT('substitution:',NEW.id),NEW.actor
  FROM visa_change_quotes q WHERE q.application_id=NEW.application_id AND q.version=NEW.version;
 END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER visa_change_decision_immutable BEFORE UPDATE ON visa_change_decisions FOR EACH ROW
BEGIN
 IF OLD.state<>'PENDING' OR NEW.state NOT IN ('APPROVED','REJECTED')
 OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL OR CHAR_LENGTH(TRIM(COALESCE(NEW.decision_reason,'')))<5
 OR NOT EXISTS(SELECT 1 FROM staff_users WHERE id=NEW.decided_by AND staff_role='admin' AND is_active='active')
 OR NOT(OLD.id<=>NEW.id) OR NOT(OLD.application_id<=>NEW.application_id) OR NOT(OLD.quote_id<=>NEW.quote_id)
 OR NOT(OLD.quote_version<=>NEW.quote_version) OR NOT(OLD.kind<=>NEW.kind) OR NOT(OLD.outcome<=>NEW.outcome)
 OR NOT(OLD.direction<=>NEW.direction) OR NOT(OLD.amount_minor<=>NEW.amount_minor) OR NOT(OLD.currency<=>NEW.currency)
 OR NOT(OLD.stripe_reference<=>NEW.stripe_reference) OR NOT(OLD.reason<=>NEW.reason)
 OR NOT(OLD.written_insistence<=>NEW.written_insistence) OR NOT(OLD.risk_record<=>NEW.risk_record)
 OR NOT(OLD.requested_by<=>NEW.requested_by) OR NOT(OLD.created_at<=>NEW.created_at) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Named administrator decision and immutable adjustment evidence required';
 END IF;
END$$
CREATE TRIGGER visa_change_decision_no_delete BEFORE DELETE ON visa_change_decisions FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Adjustment decisions cannot be deleted'; END$$
CREATE TRIGGER customer_wait_payment_link AFTER INSERT ON product_substitution_events FOR EACH ROW
BEGIN
 IF NEW.action IN ('PAYMENT_LINK_ISSUED','SETTLED') AND EXISTS(SELECT 1 FROM customer_wait_policy WHERE singleton=1 AND enabled_at IS NOT NULL AND NEW.occurred_at>=enabled_at) THEN
 INSERT IGNORE INTO customer_wait_events(id,application_id,wait_key,event_kind,reason,occurred_at,source_reference,actor_reference)
 SELECT SHA2(CONCAT('payment-wait:',q.id,':',NEW.action),256),q.application_id,CONCAT('payment:',q.id),IF(NEW.action='SETTLED','RESUME','PAUSE'),'PAYMENT_LINK_ISSUED',NEW.occurred_at,CONCAT('substitution:',NEW.id),NEW.actor
 FROM visa_change_quotes q WHERE q.application_id=NEW.application_id AND q.version=NEW.version;
 END IF;
END$$
DELIMITER ;
