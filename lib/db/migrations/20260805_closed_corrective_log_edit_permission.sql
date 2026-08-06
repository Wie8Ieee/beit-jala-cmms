INSERT INTO permissions (name, description)
VALUES (
  'edit_closed_corrective_maintenance_log',
  'Edit closed corrective maintenance log rows'
)
ON CONFLICT (name) DO NOTHING;
