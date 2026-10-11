-- Operational product cards share the existing service code and supplier rate registry.
CREATE TABLE operational_product_cards (
 service_code varchar(80) PRIMARY KEY,
 name_ar varchar(255) NOT NULL,
 name_en varchar(255) NOT NULL,
 kind enum('visa','procedure') NOT NULL,
 duration_days int unsigned NULL,
 entry_type enum('single','multiple','not_applicable') NOT NULL,
 audience enum('all','adult','child') NOT NULL,
 enabled boolean NOT NULL DEFAULT TRUE,
 instructions text NOT NULL,
 required_documents text NOT NULL,
 applicable_products_json json NOT NULL,
 version int unsigned NOT NULL DEFAULT 1,
 updated_by varchar(100) NOT NULL,
 updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE operational_product_card_audit (
 id bigint unsigned AUTO_INCREMENT PRIMARY KEY,
 service_code varchar(80) NOT NULL,
 version int unsigned NOT NULL,
 content_json json NOT NULL,
 actor varchar(100) NOT NULL,
 created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY product_card_audit_version(service_code,version)
);
ALTER TABLE supplier_product_rates
 ADD COLUMN residence_category enum('all','gcc-resident','gcc-accompany') NOT NULL DEFAULT 'all',
 ADD COLUMN vat_confirmed boolean NOT NULL DEFAULT TRUE,
 MODIFY vat_status enum('standard','zero_rated','exempt','out_of_scope') NULL,
 MODIFY vat_amount_aed decimal(10,2) NULL,
 MODIFY total_aed decimal(10,2) NULL,
 DROP INDEX supplier_rate_version,
 ADD UNIQUE KEY supplier_rate_version(supplier_id,service_code,processing_type,residence_category,version);

DELIMITER $$
CREATE TRIGGER product_card_audit_no_update BEFORE UPDATE ON operational_product_card_audit FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Product card audit is immutable'; END$$
CREATE TRIGGER product_card_audit_no_delete BEFORE DELETE ON operational_product_card_audit FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Product card audit is immutable'; END$$
DELIMITER ;
