ALTER TABLE monthly_pm_plan_rows
  ADD COLUMN IF NOT EXISTS is_manually_removed boolean NOT NULL DEFAULT false;
