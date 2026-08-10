ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS total_corrective_requests_is_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unclosed_corrective_requests_is_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_corrective_requests_is_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_external_activities_is_override boolean NOT NULL DEFAULT false;
