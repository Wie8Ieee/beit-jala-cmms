ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS manual_corrective_adjustments text NOT NULL DEFAULT '[]';

ALTER TABLE monthly_maintenance_evaluation_reports
  ADD COLUMN IF NOT EXISTS manual_preventive_adjustments text NOT NULL DEFAULT '[]';
