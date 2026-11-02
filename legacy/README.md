# Archived backends and migration tools

Production uses Cloudflare Workers, D1 and R2, with GitHub authentication through
Auth.js. Supabase and Convex are not required to run, build or deploy the app.

## Supabase migration

[The archived importer](scripts/migrate-supabase-to-convex.mjs) was used for
the completed Supabase to Convex migration. Its production URL and environment
variables are historical inputs, not application configuration. Do not run it
against production as part of normal maintenance.

Commit `6bd668d458bab674627555a9725ab4e28dcce778` records the import of all
five users, ten folders and 32 snippets, matching the source, with encryption
verified for every encrypted account. Those records were subsequently included
in the [D1 migration](../docs/d1-migration.md).

## Convex recovery source

The `convex/` project is retained only for migration verification, the source
write freeze and rollback. No deployed application route imports it. Production
is `src/server` and `migrations`, using Workers bindings and D1.

`KLIPCODE_MIGRATED=true` blocks legacy workspace reads and writes. Unset it only
when rolling back before D1 accepts new user writes, or after reconciling D1.
The CLI functions directory is configured in the root `convex.json` solely to
keep recovery commands repeatable. Convex packages are development dependencies.
