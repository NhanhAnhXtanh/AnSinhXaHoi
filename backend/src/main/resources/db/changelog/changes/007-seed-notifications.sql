--liquibase formatted sql

--changeset dth:007-seed-notifications
--comment Permissions for the notifications resource, granted to every system role.

-- Same "resource:action" shape as everything else, so the access control
-- provider derives these codes the way it derives the rest — see
-- 005-seed-security.sql.
--
-- There is no notifications:write here on purpose. Nobody edits a notification;
-- the application raises one, and NotificationService is the API for that. The
-- only thing a person does to one is read it or delete it, and both of those
-- are covered below.
INSERT INTO permissions (code, name, description) VALUES
  ('notifications:read',   'View notifications',   'See your own notifications and mark them read'),
  ('notifications:delete', 'Delete notifications', 'Permanently remove one of your own notifications');

-- Granted to all three roles, unlike every other permission in this schema.
-- These do not widen what an account can reach: every notification endpoint is
-- scoped to the caller, so the permission gates the bell in the UI rather than
-- access to anybody else's rows. An account that could not read its own
-- notifications would simply never be told anything.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('notifications:read', 'notifications:delete')
WHERE r.code IN ('ADMIN', 'MANAGER', 'USER');

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'notifications:%');
--rollback DELETE FROM permissions WHERE code LIKE 'notifications:%';
