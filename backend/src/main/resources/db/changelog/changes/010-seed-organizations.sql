--liquibase formatted sql

--changeset dth:010-seed-organizations
--comment Permissions for the organizations and departments resources, their role grants, and demo rows.

-- Same "resource:action" shape as everything else, so the access control
-- provider derives these codes from the resource name in routes.tsx the way it
-- derives the rest -- see 005-seed-security.sql.
--
-- system_permission is set explicitly here rather than backfilled the way
-- 008 did for everything that predates it: these codes arrive in this migration
-- alongside the @PreAuthorize annotations that check them, which is exactly
-- what the flag means.
INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('organizations:read',   'View organizations',       'List and open organizations',                        TRUE),
  ('organizations:write',  'Create and edit organizations', 'Create organizations and edit their details',   TRUE),
  ('organizations:delete', 'Delete organizations',     'Permanently remove an organization',                 TRUE),
  ('departments:read',     'View departments',         'List and open departments',                          TRUE),
  ('departments:write',    'Create and edit departments', 'Create departments and edit their details',       TRUE),
  ('departments:delete',   'Delete departments',       'Permanently remove a department',                    TRUE);

-- ADMIN gets everything. Note that this has to be spelled out: 005 granted
-- ADMIN every permission that existed *at the time it ran*, which is a join
-- over a table that did not yet contain these six rows. A permission added
-- later is granted to nobody until a migration says so.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'organizations:read', 'organizations:write', 'organizations:delete',
  'departments:read', 'departments:write', 'departments:delete')
WHERE r.code = 'ADMIN';

-- MANAGER maintains the department list but not the organizations it hangs
-- off. That split is the point of having two resources rather than one table
-- with a nesting level: creating a legal entity is a different decision from
-- reorganising the teams inside one, and here they are different grants.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'organizations:read',
  'departments:read', 'departments:write', 'departments:delete')
WHERE r.code = 'MANAGER';

-- USER can see the structure and change none of it. Read alone is enough for
-- the sidebar to offer both screens; without it the whole Organization section
-- disappears for that role, which is the behaviour to expect rather than a bug.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('organizations:read', 'departments:read')
WHERE r.code = 'USER';

-- Demo rows, so the two screens have something to page, sort and filter.
INSERT INTO organizations (code, name, description, email, phone, address, status, created_at) VALUES
  ('DTH',  'DTH Group',            'The parent company.',                                'contact@dth.local',  '+84 24 3900 0001', '15 Nguyen Trai, Hanoi',      'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00'),
  ('DTHS', 'DTH Software',         'Product engineering subsidiary.',                    'software@dth.local', '+84 24 3900 0002', '22 Le Duan, Hanoi',          'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-15 00:00:00+00'),
  ('DTHC', 'DTH Consulting',       'Advisory and delivery services.',                    'consult@dth.local',  '+84 28 3800 0003', '9 Ton Duc Thang, Da Nang',   'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-03-04 00:00:00+00'),
  ('DTHL', 'DTH Labs',             'Retired research arm, folded into DTH Software.',    NULL,                 NULL,               NULL,                         'INACTIVE', TIMESTAMP WITH TIME ZONE '2023-06-20 00:00:00+00');

-- Organizations are referenced by code rather than by a hardcoded id, for the
-- same reason the other seeds join on natural keys: the id column is an
-- identity, so pinning ids would leave its sequence behind and the first insert
-- from the application would collide.
--
-- ENG appears twice on purpose, under two different organizations. That is
-- exactly what the (organization_id, code) unique constraint permits and a
-- global unique on code would not.
INSERT INTO departments (code, name, description, organization_id, email, phone, status, created_at)
SELECT v.code, v.name, v.description, o.id, v.email, v.phone, v.status, v.created_at
FROM (VALUES
  ('EXEC',  'Executive Office',   'Board and company officers.',                'DTH',  'exec@dth.local',      '+84 24 3900 0010', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00'),
  ('FIN',   'Finance',            'Accounting, payroll and procurement.',       'DTH',  'finance@dth.local',   '+84 24 3900 0011', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-02 00:00:00+00'),
  ('HR',    'People Operations',  'Hiring, onboarding and employee records.',   'DTH',  'people@dth.local',    '+84 24 3900 0012', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-02 00:00:00+00'),
  ('ENG',   'Engineering',        'Platform, product and infrastructure teams.','DTHS', 'eng@dth.local',       '+84 24 3900 0020', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-20 00:00:00+00'),
  ('QA',    'Quality Assurance',  'Test engineering and release verification.', 'DTHS', 'qa@dth.local',        '+84 24 3900 0021', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-01-20 00:00:00+00'),
  ('DESIGN','Design',             'Product design and the design system.',      'DTHS', 'design@dth.local',    NULL,               'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-02-01 00:00:00+00'),
  ('ENG',   'Delivery Engineering','Client-facing delivery teams.',             'DTHC', 'delivery@dth.local',  '+84 28 3800 0030', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-03-10 00:00:00+00'),
  ('SALES', 'Sales',              'New business and account management.',       'DTHC', 'sales@dth.local',     '+84 28 3800 0031', 'ACTIVE',   TIMESTAMP WITH TIME ZONE '2024-03-10 00:00:00+00'),
  ('RND',   'Research',           'Disbanded when DTH Labs closed.',            'DTHL', NULL,                  NULL,               'INACTIVE', TIMESTAMP WITH TIME ZONE '2023-06-20 00:00:00+00')
) AS v(code, name, description, org_code, email, phone, status, created_at)
JOIN organizations o ON o.code = v.org_code;

--rollback DELETE FROM departments;
--rollback DELETE FROM organizations;
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'organizations:%' OR code LIKE 'departments:%');
--rollback DELETE FROM permissions WHERE code LIKE 'organizations:%' OR code LIKE 'departments:%';
