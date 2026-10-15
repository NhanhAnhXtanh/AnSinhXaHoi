--liquibase formatted sql

--changeset dth:014-seed-tasks
--comment Permissions for the tasks resource, the role grants, and demo rows.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('tasks:read',   'View tasks',            'List and open tasks',                    TRUE),
  ('tasks:write',  'Create and edit tasks', 'Raise tasks, assign them and move them', TRUE),
  ('tasks:delete', 'Delete tasks',          'Permanently remove a task',              TRUE);

-- Spelled out for ADMIN, like 007 and 010: 005 granted ADMIN every permission
-- that existed *when it ran*, so a code added later reaches nobody until a
-- migration says so.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('tasks:read', 'tasks:write', 'tasks:delete')
WHERE r.code = 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('tasks:read', 'tasks:write', 'tasks:delete')
WHERE r.code = 'MANAGER';

-- USER gets write as well as read, which is broader than it looks and is worth
-- being explicit about: tasks:write is not ownership-scoped, so it lets any
-- signed-in account edit or reassign anybody's task, not only its own. That is
-- the same model every other resource here uses -- the only row-level scoping
-- in this application is on notifications, and it is deliberate there.
--
-- The alternative is worse in practice: without write, somebody cannot tick
-- their own task done, which is most of what a task list is for. Narrowing this
-- properly means row-level ownership (assignee or creator may edit, others need
-- a wider grant), which is a concept the application does not have yet.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('tasks:read', 'tasks:write')
WHERE r.code = 'USER';

-- Demo rows, so the screens have something to page, sort and filter. Joined by
-- natural key on every side -- users by username, departments by (organization,
-- code) -- for the same reason the other seeds are: the id columns are
-- identities, and pinning ids would leave their sequences behind.
--
-- The dates are relative to the moment this runs rather than fixed, so that the
-- overdue filter has something to find on a checkout made at any time. That is
-- a deliberate exception to the fixed timestamps the other seeds use, where
-- reproducibility mattered more than the row being interesting.
INSERT INTO tasks (title, description, status, priority, assignee_id, department_id, due_date, completed_at, created_by_id, created_at)
SELECT
  v.title,
  v.description,
  v.status,
  v.priority,
  assignee.id,
  d.id,
  CURRENT_DATE + v.due_in_days,
  CASE WHEN v.status = 'DONE' THEN NOW() - INTERVAL '2 days' ELSE NULL END,
  author.id,
  NOW() - (v.age_in_days * INTERVAL '1 day')
FROM (VALUES
  ('Draft the Q3 engineering roadmap',      'Collect input from each squad lead and publish a single plan.',        'IN_PROGRESS', 'HIGH',   'manager', 'DTHS', 'ENG',    7,   9),
  ('Review the access control audit',       'Walk the seeded roles against the permission catalogue.',              'TODO',        'URGENT', 'admin',   'DTH',  'EXEC',  -3,  14),
  ('Migrate the staging database',          'Run the outstanding Liquibase changesets against staging.',            'BLOCKED',     'HIGH',   'manager', 'DTHS', 'ENG',   -1,  11),
  ('Write onboarding notes for new hires',  'One page covering the local setup and the seeded accounts.',           'TODO',        'LOW',    NULL,      'DTH',  'HR',     21,  4),
  ('Close the Q2 books',                    'Reconcile the ledger and hand the summary to the auditors.',           'DONE',        'MEDIUM', 'admin',   'DTH',  'FIN',   -10, 30),
  ('Refresh the design system tokens',      'Align the chart ramp with the new brand palette.',                     'TODO',        'MEDIUM', NULL,      'DTHS', 'DESIGN', 30,  2),
  ('Prepare the client renewal pack',       'Pull usage figures and last year''s terms for the renewal meeting.',   'IN_PROGRESS', 'HIGH',   'viewer',  'DTHC', 'SALES',  4,   6),
  -- No deadline, which is the other shape a task takes and worth having in the
  -- seed so the screens are exercised against it.
  ('Retire the legacy reporting job',       'Superseded by the new dashboard; confirm nothing still reads it.',     'CANCELLED',   'LOW',    NULL,      'DTHS', 'ENG',    NULL, 45)
) AS v(title, description, status, priority, assignee_username, org_code, dept_code, due_in_days, age_in_days)
JOIN organizations o ON o.code = v.org_code
JOIN departments d ON d.organization_id = o.id AND d.code = v.dept_code
JOIN users author ON author.username = 'admin'
LEFT JOIN users assignee ON assignee.username = v.assignee_username;

--rollback DELETE FROM tasks;
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'tasks:%');
--rollback DELETE FROM permissions WHERE code LIKE 'tasks:%';
