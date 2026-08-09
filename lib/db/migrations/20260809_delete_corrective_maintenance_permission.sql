INSERT INTO "permissions" ("name", "description")
VALUES ('delete_corrective_maintenance', 'Delete corrective maintenance log rows')
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";
