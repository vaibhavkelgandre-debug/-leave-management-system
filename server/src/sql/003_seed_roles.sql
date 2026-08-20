-- ON CONFLICT DO NOTHING so a replay is a no-op rather than a unique
-- violation on role_name — same shape as 034_seed_super_admin_role.sql.
INSERT INTO roles (role_name, description)
VALUES

('HR_ADMIN', 'Human Resource Administrator'),

('MANAGER', 'Reporting Manager'),

('EMPLOYEE', 'Employee')

ON CONFLICT (role_name) DO NOTHING;
