INSERT INTO permissions (name, description)
VALUES (
  'view_machine_maintenance_history',
  'View machine maintenance history'
)
ON CONFLICT (name) DO NOTHING;
