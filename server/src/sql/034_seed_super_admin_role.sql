-- Adds the SUPER_ADMIN role: a single, top-level administrator created once
-- via the repurposed POST /auth/register/hr bootstrap route, sitting above
-- every HR_ADMIN so the very first account in the system has someone who can
-- approve their leave requests and verify their profile (previously
-- impossible for a manager-less root HR_ADMIN). ON CONFLICT DO NOTHING since
-- role_name is already UNIQUE (002_create_roles.sql) and this should only
-- ever insert once.
INSERT INTO roles (role_name, description)
VALUES ('SUPER_ADMIN', 'Single top-level administrator, created once via bootstrap')
ON CONFLICT (role_name) DO NOTHING;
