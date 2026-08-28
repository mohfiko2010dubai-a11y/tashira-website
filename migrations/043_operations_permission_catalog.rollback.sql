-- Delete only unused catalog rows. Referenced permissions remain protected by the RBAC foreign key.
DELETE p FROM `operations_permissions` p
LEFT JOIN `operations_role_permissions` rp ON rp.permission_id=p.id
WHERE p.code IN (
  'support.read','support.reply','rule.propose','rule.activate','role.manage','authority.record_submission'
) AND rp.permission_id IS NULL;

