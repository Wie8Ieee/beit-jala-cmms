ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS engineering_manager_date text;
