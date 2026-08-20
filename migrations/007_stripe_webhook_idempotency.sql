-- Stripe TEST webhook replay protection. Apply only through the approved staging migration process.
CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
  `event_id` varchar(255) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `payment_intent_id` varchar(255) NOT NULL,
  `processing_status` enum('processing','processed','failed') NOT NULL,
  `attempt_count` bigint unsigned NOT NULL DEFAULT 1,
  `processed_at` datetime NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  KEY `stripe_webhook_payment_intent_idx` (`payment_intent_id`,`created_at`)
);
