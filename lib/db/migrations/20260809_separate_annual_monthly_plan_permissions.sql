INSERT INTO "permissions" ("name", "description") VALUES
  ('view_annual_maintenance_plan', 'View annual maintenance plan'),
  ('edit_annual_maintenance_plan', 'Edit annual maintenance plan'),
  ('view_monthly_maintenance_plan', 'View monthly maintenance plan'),
  ('edit_monthly_maintenance_plan', 'Edit monthly maintenance plan')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

-- Preserve the access of all existing accounts while replacing the former
-- combined plan permissions with independent annual/monthly permissions.
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT DISTINCT source."user_id", target."id"
FROM "user_permissions" source
JOIN "permissions" old_permission ON old_permission."id" = source."permission_id"
JOIN "permissions" target ON target."name" IN (
  'view_annual_maintenance_plan',
  'view_monthly_maintenance_plan'
)
WHERE old_permission."name" = 'view_maintenance_plans'
  AND NOT EXISTS (
    SELECT 1 FROM "user_permissions" existing
    WHERE existing."user_id" = source."user_id"
      AND existing."permission_id" = target."id"
  );

INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT DISTINCT source."user_id", target."id"
FROM "user_permissions" source
JOIN "permissions" old_permission ON old_permission."id" = source."permission_id"
JOIN "permissions" target ON target."name" IN (
  'edit_annual_maintenance_plan',
  'edit_monthly_maintenance_plan'
)
WHERE old_permission."name" = 'edit_maintenance_plans'
  AND NOT EXISTS (
    SELECT 1 FROM "user_permissions" existing
    WHERE existing."user_id" = source."user_id"
      AND existing."permission_id" = target."id"
  );

INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT DISTINCT source."user_id", target."id"
FROM "user_permissions" source
JOIN "permissions" old_permission ON old_permission."id" = source."permission_id"
JOIN "permissions" target ON target."name" IN (
  'view_monthly_maintenance_plan',
  'edit_monthly_maintenance_plan'
)
WHERE old_permission."name" = 'edit_monthly_pm_plan_rows'
  AND NOT EXISTS (
    SELECT 1 FROM "user_permissions" existing
    WHERE existing."user_id" = source."user_id"
      AND existing."permission_id" = target."id"
  );
