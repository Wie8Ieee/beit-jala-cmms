INSERT INTO permissions (name, description)
VALUES
  ('view_dashboard_notifications', 'View dashboard notifications'),
  ('view_dashboard_machines', 'View machine statistics on the dashboard'),
  ('view_dashboard_users', 'View user statistics on the dashboard'),
  ('view_dashboard_departments', 'View department statistics on the dashboard'),
  ('view_dashboard_preventive_maintenance', 'View preventive maintenance widgets on the dashboard'),
  ('view_dashboard_maintenance_requests', 'View maintenance request widgets on the dashboard'),
  ('view_dashboard_corrective_maintenance', 'View corrective maintenance widgets on the dashboard'),
  ('view_dashboard_spare_parts', 'View spare-part widgets on the dashboard')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Preserve the current dashboard for existing users. Administrators can then
-- remove individual section permissions from the user-permissions screen.
INSERT INTO user_permissions (user_id, permission_id)
SELECT up.user_id, section_permission.id
FROM user_permissions up
JOIN permissions dashboard_permission ON dashboard_permission.id = up.permission_id
CROSS JOIN permissions section_permission
WHERE dashboard_permission.name = 'view_dashboard'
  AND section_permission.name IN (
    'view_dashboard_notifications',
    'view_dashboard_machines',
    'view_dashboard_users',
    'view_dashboard_departments',
    'view_dashboard_preventive_maintenance',
    'view_dashboard_maintenance_requests',
    'view_dashboard_corrective_maintenance',
    'view_dashboard_spare_parts'
  )
ON CONFLICT DO NOTHING;
