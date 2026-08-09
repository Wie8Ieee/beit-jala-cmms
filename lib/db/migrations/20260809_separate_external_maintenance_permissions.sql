-- Editing no longer implicitly grants viewing. Preserve existing users' access
-- by granting the independent view permission to every current editor.
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT editor."user_id", viewer_permission."id"
FROM "user_permissions" AS editor
JOIN "permissions" AS editor_permission
  ON editor_permission."id" = editor."permission_id"
CROSS JOIN "permissions" AS viewer_permission
WHERE editor_permission."name" = 'edit_external_maintenance'
  AND viewer_permission."name" = 'view_external_maintenance'
  AND NOT EXISTS (
    SELECT 1
    FROM "user_permissions" AS existing
    WHERE existing."user_id" = editor."user_id"
      AND existing."permission_id" = viewer_permission."id"
  );

UPDATE "permissions"
SET "description" = 'View external maintenance requests and receipts'
WHERE "name" = 'view_external_maintenance';

UPDATE "permissions"
SET "description" = 'Edit external maintenance requests and receipts'
WHERE "name" = 'edit_external_maintenance';
