-- Null for historical/manual costs. Existing supplier bookings are not rewritten.
ALTER TABLE applications
  ADD COLUMN supplier_rate_id bigint unsigned NULL,
  ADD COLUMN supplier_rate_quantity int unsigned NULL,
  ADD CONSTRAINT application_supplier_rate_fk FOREIGN KEY (supplier_rate_id) REFERENCES supplier_product_rates(id) ON DELETE RESTRICT;
