INSERT INTO permissions (name, description)
VALUES
  ('edit_pm_inspection', 'Edit preventive maintenance inspections'),
  ('delete_pm_inspection', 'Delete preventive maintenance inspections')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
