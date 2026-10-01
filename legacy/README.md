# Legacy source backend

This Convex project is retained only for migration verification, the source
write freeze and rollback. No deployed application route imports it. Production
is `src/server` and `migrations`, using Workers bindings and D1.

`KLIPCODE_MIGRATED=true` blocks legacy workspace reads and writes. Unset it only
when rolling back before D1 accepts new user writes, or after reconciling D1.
The CLI functions directory is configured in the root `convex.json` solely to
keep recovery commands repeatable. Convex packages are development dependencies.
