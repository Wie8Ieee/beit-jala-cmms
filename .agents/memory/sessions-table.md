---
name: connect-pg-simple sessions table
description: The sessions table must exist before the API starts; createTableIfMissing won't work with esbuild bundles.
---

# connect-pg-simple sessions table

**Rule:** Do NOT use `createTableIfMissing: true` in the connect-pg-simple config when using an esbuild bundle. Create the sessions table manually instead.

**Why:** `createTableIfMissing` reads `table.sql` from a path relative to the installed module. When bundled with esbuild, the module resolves the path against the dist/ output directory where the SQL file doesn't exist, causing `ENOENT: no such file or directory, open '.../dist/table.sql'` on every startup.

**How to apply:**
Run this SQL once against the dev (and prod) database:
```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
```

Connect-pg-simple config:
```typescript
new PgSession({
  pool,
  tableName: "sessions",
  // NO createTableIfMissing: true
})
```
