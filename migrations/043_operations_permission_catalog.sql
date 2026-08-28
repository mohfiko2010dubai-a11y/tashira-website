-- Canonical additive RBAC permission catalog used by the trusted Operations access provider.
-- Existing permission descriptions/risk classifications are preserved; only missing codes are inserted.
INSERT IGNORE INTO `operations_permissions` (`code`,`description`,`risk_level`) VALUES
  ('support.read','Read scoped customer-support threads','MEDIUM'),
  ('support.reply','Send attributable replies to scoped support threads','HIGH'),
  ('rule.propose','Propose a new governed rule or policy version','HIGH'),
  ('rule.activate','Activate an approved governed rule or policy version','CRITICAL'),
  ('role.manage','Manage Operations role and scope grants','CRITICAL'),
  ('authority.record_submission','Record attributable authority submission evidence','HIGH');

