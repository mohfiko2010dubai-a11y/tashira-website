-- Supplier costs are independently versioned reference data, not customer prices.
-- No inferred prices, tax registrations or rates are seeded.
CREATE TABLE supplier_product_rates (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id bigint unsigned NOT NULL,
  service_code varchar(80) NOT NULL,
  processing_type enum('regular','express') NOT NULL,
  version bigint unsigned NOT NULL,
  cost_aed decimal(10,2) NOT NULL,
  vat_amount_aed decimal(10,2) NOT NULL,
  total_aed decimal(10,2) NOT NULL,
  vat_status enum('standard','zero_rated','exempt','out_of_scope') NOT NULL,
  place_of_supply enum('within_uae','outside_uae') NOT NULL,
  active boolean NOT NULL,
  reason varchar(500) NOT NULL,
  created_by varchar(100) NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY supplier_rate_version (supplier_id,service_code,processing_type,version),
  CONSTRAINT supplier_rate_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT supplier_rate_amounts CHECK (cost_aed>=0 AND vat_amount_aed>=0 AND total_aed=cost_aed+vat_amount_aed),
  CONSTRAINT supplier_rate_vat CHECK (vat_status='standard' OR vat_amount_aed=0)
) ENGINE=InnoDB;

DELIMITER $$
CREATE TRIGGER supplier_rates_no_update BEFORE UPDATE ON supplier_product_rates FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Supplier rates are immutable; create a new version'; END$$
CREATE TRIGGER supplier_rates_no_delete BEFORE DELETE ON supplier_product_rates FOR EACH ROW
BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Supplier rate history cannot be deleted'; END$$
DELIMITER ;
