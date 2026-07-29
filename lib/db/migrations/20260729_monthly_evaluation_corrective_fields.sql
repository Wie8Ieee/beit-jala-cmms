ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS corrective_maintenance_details text,
  ADD COLUMN IF NOT EXISTS total_corrective_requests integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unclosed_corrective_requests integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_corrective_requests integer NOT NULL DEFAULT 0;
