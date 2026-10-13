DROP TRIGGER IF EXISTS visa_change_quote_immutable;
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
DELIMITER ;
