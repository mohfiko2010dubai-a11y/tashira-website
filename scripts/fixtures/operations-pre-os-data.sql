-- Synthetic-only legacy rows for the disposable Operations OS migration rehearsal.
-- No Production/customer data or credentials are permitted in this fixture.
INSERT INTO suppliers (id,name,is_active) VALUES (1,'Synthetic Supplier','active');
INSERT INTO staff_users (id,username,password_hash,name,email,is_active) VALUES
  (1,'synthetic-operator','not-a-real-password-hash','Synthetic Operator','operator@example.invalid','active');

INSERT INTO applications
  (id,reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,
   exchange_rate,total_amount_aed,total_amount_usd,supplier_id,supplier_cost_aed,status,payment_status)
VALUES
  (1,'TSH-REHEARSAL-FAMILY','family','non-gcc','30-days','regular','family@example.invalid','0000000000',3.67,1000,272.48,1,400,'documents_received','paid'),
  (2,'TSH-REHEARSAL-SINGLE','single','gcc-resident','14-days','regular','single@example.invalid','0000000000',3.67,500,136.24,NULL,NULL,'documents_pending','pending');

INSERT INTO applicants (id,application_id,applicant_index,full_name,nationality,passport_number) VALUES
  (1,1,0,'Synthetic Lead','EG','SYN-P-001'),
  (2,1,1,'Synthetic Spouse','IN','SYN-P-002'),
  (3,1,2,'Synthetic Child One','EG','SYN-P-003'),
  (4,1,3,'Synthetic Child Two','PH','SYN-P-004'),
  (5,2,0,'Synthetic Single','JO','SYN-P-005');

INSERT INTO documents
  (id,application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status)
VALUES
  (1,1,1,'passport','synthetic-passport-1.pdf','synthetic-1.pdf','application/pdf',100,'synthetic/rehearsal/1','uploaded'),
  (2,1,2,'passport','synthetic-passport-2.pdf','synthetic-2.pdf','application/pdf',100,'synthetic/rehearsal/2','uploaded'),
  (3,1,3,'photo','synthetic-photo-3.jpg','synthetic-3.jpg','image/jpeg',100,'synthetic/rehearsal/3','uploaded'),
  (4,1,4,'photo','synthetic-photo-4.jpg','synthetic-4.jpg','image/jpeg',100,'synthetic/rehearsal/4','uploaded'),
  (5,2,5,'passport','synthetic-passport-5.pdf','synthetic-5.pdf','application/pdf',100,'synthetic/rehearsal/5','uploaded');

INSERT INTO payments (id,application_id,stripe_payment_intent_id,amount,currency,status)
VALUES (1,1,'pi_synthetic_rehearsal',272.48,'USD','succeeded');
INSERT INTO invoices (id,invoice_number,application_id,payment_id,amount)
VALUES (1,'INV-SYNTHETIC-REHEARSAL',1,1,272.48);
