import pg from "../lib/db/node_modules/pg/lib/index.js";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("BEGIN");
  const permissions = [
    ["view_external_maintenance", "View external maintenance request and receipt"],
    ["edit_external_maintenance", "View and edit external maintenance request and receipt"],
  ];
  for (const [name, description] of permissions) {
    await client.query(
      "INSERT INTO permissions (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
      [name, description],
    );
  }
  await client.query(`
    INSERT INTO user_permissions (user_id, permission_id)
    SELECT existing.user_id, added.id
    FROM user_permissions existing
    JOIN permissions previous ON previous.id = existing.permission_id
    CROSS JOIN permissions added
    WHERE previous.name = 'manage_maintenance_requests'
      AND added.name IN ('view_external_maintenance', 'edit_external_maintenance')
    ON CONFLICT DO NOTHING
  `);
  await client.query("COMMIT");
  console.log("External-maintenance permissions installed");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
