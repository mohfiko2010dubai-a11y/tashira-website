-- Adds an explicit customer-visible OPTIONAL classification. INTERNAL remains non-customer-visible.
-- This does not activate any requirement or change any existing classification.
ALTER TABLE `requirement_definitions`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','OPTIONAL','INTERNAL') NOT NULL;

ALTER TABLE `requirement_question_definitions`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','OPTIONAL','INTERNAL') NOT NULL;

ALTER TABLE `applicant_requirement_instances`
  MODIFY COLUMN `classification` enum('OFFICIAL','OPERATIONAL','CONDITIONAL','OPTIONAL','INTERNAL') NULL;
