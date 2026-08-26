ALTER TABLE `dynamic_interview_answer_events`
  DROP INDEX `dynamic_answer_transition_uq`,
  DROP INDEX `dynamic_answer_hash_lookup_idx`,
  ADD UNIQUE KEY `dynamic_answer_hash_uq` (`application_id`,`applicant_id`,`question_definition_id`,`answer_sha256`);
