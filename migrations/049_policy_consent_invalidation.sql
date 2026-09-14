CREATE TABLE policy_consent_invalidations (
  event_id varchar(36) NOT NULL PRIMARY KEY,
  reason enum('LEGACY_AUTOMATIC','UNVERIFIED_SOURCE') NOT NULL,
  flagged_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invalid_consent_event_fk FOREIGN KEY (event_id) REFERENCES application_timeline_events(id) ON DELETE RESTRICT
);
INSERT INTO policy_consent_invalidations (event_id,reason)
SELECT id,CASE WHEN event_source IN ('APPLICATION_API','CHATBOT_WIZARD') THEN 'LEGACY_AUTOMATIC' ELSE 'UNVERIFIED_SOURCE' END
FROM application_timeline_events WHERE event_name='POLICY_ACCEPTED' AND (event_source<>'PAYMENT_API' OR actor_type<>'CUSTOMER');
DELIMITER $$
CREATE TRIGGER policy_consent_invalidation_no_update BEFORE UPDATE ON policy_consent_invalidations FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Consent invalidations are append-only'; END$$
CREATE TRIGGER policy_consent_invalidation_no_delete BEFORE DELETE ON policy_consent_invalidations FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Consent invalidations are append-only'; END$$
-- Protect the deploy window and any future use of an obsolete integration.
CREATE TRIGGER policy_consent_flag_source AFTER INSERT ON application_timeline_events FOR EACH ROW
BEGIN
  IF NEW.event_name='POLICY_ACCEPTED' AND (NEW.event_source<>'PAYMENT_API' OR NEW.actor_type<>'CUSTOMER') THEN
    INSERT INTO policy_consent_invalidations (event_id,reason) VALUES (NEW.id,
      CASE WHEN NEW.event_source IN ('APPLICATION_API','CHATBOT_WIZARD') THEN 'LEGACY_AUTOMATIC' ELSE 'UNVERIFIED_SOURCE' END);
  END IF;
END$$
DELIMITER ;
