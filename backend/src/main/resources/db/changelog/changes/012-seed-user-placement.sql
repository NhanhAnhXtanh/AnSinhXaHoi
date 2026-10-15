--liquibase formatted sql

--changeset dth:012-seed-user-placement
--comment Places the three development accounts, so the new fields are visible on a fresh checkout.

-- Joined by natural key on both sides, like every other seed here: users by
-- username, organizations by code, departments by (organization, code). The
-- department join carries the organization too, which is what makes this insert
-- satisfy the composite foreign key by construction rather than by luck.
UPDATE users u
SET organization_id = d.organization_id,
    department_id   = d.id
FROM (VALUES
  ('admin',   'DTH',  'EXEC'),
  ('manager', 'DTHS', 'ENG')
) AS v(username, org_code, dept_code)
JOIN organizations o ON o.code = v.org_code
JOIN departments d ON d.organization_id = o.id AND d.code = v.dept_code
WHERE u.username = v.username;

-- The viewer is placed in an organization and in no department, which is the
-- other legal shape and the one the CHECK constraint exists to keep distinct
-- from its mirror image. Worth having in the seed data so the screens are
-- exercised against both.
UPDATE users
SET organization_id = (SELECT id FROM organizations WHERE code = 'DTHC')
WHERE username = 'viewer';

--rollback UPDATE users SET organization_id = NULL, department_id = NULL;
