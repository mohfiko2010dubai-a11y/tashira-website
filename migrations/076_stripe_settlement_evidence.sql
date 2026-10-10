-- Provider balance movements, not quoted FX or a final accounting profit.
CREATE TABLE stripe_settlement_evidence (
  source_kind enum('PAYMENT','REFUND') NOT NULL,
  source_id varchar(36) NOT NULL,
  application_id bigint unsigned NOT NULL,
  provider_id varchar(100) NOT NULL,
  balance_transaction_id varchar(100) NOT NULL,
  settlement_currency char(3) NOT NULL,
  gross_minor bigint NOT NULL,
  fee_minor bigint NOT NULL,
  net_minor bigint NOT NULL,
  exchange_rate varchar(50) NULL,
  source_amount_minor bigint unsigned NOT NULL,
  source_currency char(3) NOT NULL,
  stripe_mode enum('TEST','LIVE') NOT NULL,
  evidence_sha256 char(64) NOT NULL,
  recorded_by varchar(100) NOT NULL,
  recorded_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(source_kind,source_id),
  UNIQUE KEY settlement_transaction_uq(balance_transaction_id),
  CONSTRAINT settlement_application_fk FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_net_ck CHECK(net_minor=gross_minor-fee_minor)
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER settlement_evidence_no_update BEFORE UPDATE ON stripe_settlement_evidence FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Settlement evidence is immutable'; END$$
CREATE TRIGGER settlement_evidence_no_delete BEFORE DELETE ON stripe_settlement_evidence FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Settlement evidence is immutable'; END$$
DELIMITER ;
