INSERT INTO permissions (name, description)
VALUES (
  'set_maintenance_request_number_start',
  'Set maintenance request numbering start'
)
ON CONFLICT (name) DO NOTHING;
