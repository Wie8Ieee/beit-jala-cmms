---
name: bcrypt native build
description: bcrypt requires its native module to be built; pnpm blocks this by default.
---

# bcrypt native build

**Rule:** bcrypt must be listed in `onlyBuiltDependencies` in `pnpm-workspace.yaml`, or pnpm will skip its native module build and bcrypt will silently fail.

**Why:** pnpm blocks build scripts by default for security. bcrypt depends on a native .node binding (napi-v3/bcrypt_lib.node). If the build script is blocked, `require('bcrypt')` loads but all hash/compare calls fail.

**How to apply:**
```yaml
# pnpm-workspace.yaml
onlyBuiltDependencies:
  - bcrypt
  - esbuild
  # ... other existing entries
```

After adding, run `pnpm install` again — it will download and build the .node binary.
