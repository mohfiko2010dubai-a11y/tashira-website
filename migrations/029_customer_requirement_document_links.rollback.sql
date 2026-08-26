DROP TRIGGER IF EXISTS `requirement_document_links_no_delete`;
DROP TRIGGER IF EXISTS `requirement_document_links_no_update`;
DROP TABLE IF EXISTS `applicant_requirement_document_links`;

ALTER TABLE `customer_interview_command_events`
  MODIFY COLUMN `command_type` enum(
    'DEFINE_RELATIONSHIP','DEFINE_TRAVEL_GROUP','UPDATE_TRAVEL_GROUP','LINK_SHARED_DOCUMENT'
  ) NOT NULL;
