ALTER TABLE monthly_pm_plan_rows
  ADD COLUMN IF NOT EXISTS actual_date_is_override boolean NOT NULL DEFAULT false;
