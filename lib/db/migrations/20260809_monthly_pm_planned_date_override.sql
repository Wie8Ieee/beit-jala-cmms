ALTER TABLE "monthly_pm_plan_rows"
  ADD COLUMN IF NOT EXISTS "planned_date_is_override" boolean NOT NULL DEFAULT false;
