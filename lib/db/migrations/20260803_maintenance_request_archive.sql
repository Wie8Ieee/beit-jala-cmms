ALTER TABLE "maintenance_requests"
ADD COLUMN IF NOT EXISTS "archived_at" timestamp,
ADD COLUMN IF NOT EXISTS "archived_by_user_id" integer REFERENCES "users"("id");

INSERT INTO "permissions" ("name", "description")
VALUES ('archive_maintenance_requests', 'Archive and restore maintenance requests')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT u.id, p.id
FROM "users" u
JOIN "roles" r ON r.id = u.role_id
CROSS JOIN "permissions" p
WHERE r.name = 'Maintenance Supervisor'
  AND p.name = 'archive_maintenance_requests'
  AND NOT EXISTS (
    SELECT 1 FROM "user_permissions" up
    WHERE up.user_id = u.id AND up.permission_id = p.id
  );
