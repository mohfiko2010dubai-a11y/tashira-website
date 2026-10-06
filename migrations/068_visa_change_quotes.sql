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
 state ENUM('PROPOSED','ACCEPTED','PAYMENT_PENDING','REFUND_PENDING','SETTLED','SUPERSEDED') NOT NULL DEFAULT 'PROPOSED',
 accepted_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY visa_change_version (application_id,version),
 UNIQUE KEY visa_change_payment (payment_id),
 UNIQUE KEY visa_change_refund (refund_case_id),
 CONSTRAINT visa_change_payment_fk FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_application FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE RESTRICT,
 CONSTRAINT visa_change_amounts CHECK(old_total_minor>=0 AND new_total_minor>=0 AND difference_minor=new_total_minor-old_total_minor),
 CONSTRAINT visa_change_currency CHECK(currency='USD')
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
   (OLD.state='PROPOSED' AND NEW.state IN ('ACCEPTED','SUPERSEDED')) OR
   (OLD.state='PROPOSED' AND NEW.state='SETTLED' AND NEW.difference_minor=0 AND NEW.accepted_at IS NOT NULL) OR
   (OLD.state='ACCEPTED' AND NEW.state='PAYMENT_PENDING' AND NEW.difference_minor>0) OR
   (OLD.state='ACCEPTED' AND NEW.state='REFUND_PENDING' AND NEW.difference_minor<0) OR
   (OLD.state IN ('PAYMENT_PENDING','REFUND_PENDING') AND NEW.state='SETTLED')
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
   AND q.version=NEW.substitution_version AND q.state<>'SETTLED') THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Settle the accepted visa-change difference before filing';
 END IF;
END$$
DELIMITER ;
