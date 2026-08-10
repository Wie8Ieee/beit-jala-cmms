ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS total_pm_activities_is_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_pm_on_time_is_override boolean NOT NULL DEFAULT false;
