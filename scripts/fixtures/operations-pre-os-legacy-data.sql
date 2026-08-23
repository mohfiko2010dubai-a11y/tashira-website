-- Synthetic fixtures only. Names, references, documents and payment IDs are fictional.
INSERT INTO `users` (`id`,`union_id`,`name`,`email`,`role`) VALUES
  (1,'synthetic-owner','Synthetic Owner','owner@example.invalid','admin');
INSERT INTO `staff_users` (`id`,`username`,`password_hash`,`name`,`email`) VALUES
  (1,'legacy-operator','synthetic-not-a-real-hash','Legacy Operator','operator@example.invalid');
INSERT INTO `suppliers` (`id`,`name`) VALUES (1,'Synthetic Visa Supplier');
INSERT INTO `applications` (`id`,`reference_number`,`base_type`,`residence_type`,`visa_type`,`processing_type`,`contact_email`,`contact_phone`,`exchange_rate`,`total_amount_aed`,`total_amount_usd`,`supplier_id`,`supplier_cost_aed`,`status`,`payment_status`,`stripe_payment_intent_id`,`invoice_number`) VALUES
  (1,'SYN-LEGACY-FAMILY-001','family','non-gcc','30-days','regular','family@example.invalid','+0000000000',3.6725,1248.65,340.00,1,700.00,'documents_received','paid','pi_synthetic_legacy_001','INV-SYN-001'),
  (2,'SYN-LEGACY-SINGLE-002','single','gcc-resident','30-days','express','single@example.invalid','+0000000001',3.6725,771.23,210.00,1,410.00,'submitted','pending',NULL,NULL);
INSERT INTO `applicants` (`id`,`application_id`,`applicant_index`,`full_name`,`nationality`,`passport_number`) VALUES
  (1,1,0,'Synthetic Father','Egypt','SYN-EG-001'),
  (2,1,1,'Synthetic Mother','Pakistan','SYN-PK-002'),
  (3,1,2,'Synthetic Child One','India','SYN-IN-003'),
  (4,1,3,'Synthetic Child Two','Philippines','SYN-PH-004'),
  (5,2,0,'Synthetic Single Applicant','Jordan','SYN-JO-005');
INSERT INTO `documents` (`id`,`application_id`,`applicant_id`,`document_type`,`original_file_name`,`stored_file_name`,`mime_type`,`file_size`,`storage_path`) VALUES
  (1,1,1,'passport','synthetic-father.pdf','synthetic-1.pdf','application/pdf',1000,'synthetic/1/passport.pdf'),
  (2,1,2,'passport','synthetic-mother.pdf','synthetic-2.pdf','application/pdf',1001,'synthetic/2/passport.pdf'),
  (3,1,3,'photo','synthetic-child-1.jpg','synthetic-3.jpg','image/jpeg',1002,'synthetic/3/photo.jpg'),
  (4,1,4,'photo','synthetic-child-2.jpg','synthetic-4.jpg','image/jpeg',1003,'synthetic/4/photo.jpg'),
  (5,2,5,'passport','synthetic-single.pdf','synthetic-5.pdf','application/pdf',1004,'synthetic/5/passport.pdf');
INSERT INTO `payments` (`id`,`application_id`,`stripe_payment_intent_id`,`amount`,`currency`,`status`) VALUES
  (1,1,'pi_synthetic_legacy_001',340.00,'USD','succeeded');
INSERT INTO `invoices` (`id`,`invoice_number`,`application_id`,`payment_id`,`amount`) VALUES
  (1,'INV-SYN-001',1,1,340.00);
