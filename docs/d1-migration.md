# D1 migration

The application and analytics console use Cloudflare Workers and the `klipcode`
D1 database. Production request paths have no Convex calls or VPS dependency.
GitHub accounts retain their existing user ids, so IndexedDB ownership and R2
image paths remain valid. Ciphertext and wrapped DEKs are copied without
re-encryption. The master key stays the existing `klipcode` Worker secret.

## Data and sessions

- D1 workspace reads and writes include the authenticated owner in every query.
- Browser writes require the app's origin and expected account id; a cookie
  change during sync cannot upload ciphertext into another account.
- Auth.js issues HTTP-only, Secure, SameSite cookies. Only hashes of opaque
  session tokens are stored in D1. GitHub numeric identity ids resolve to the
  imported users. Existing Convex sessions require GitHub sign-in again.
- Writes use indexed primary keys, last-write-wins timestamps and atomic D1
  batches. SQL triggers maintain deletion logs and analytics metadata.
- Pulls use a server-clock cursor, a one-minute overlap and a 30-day deletion
  window. Old cursors and the pre-migration backend epoch force a full pull.
- Encryption failures stop sync and retain dirty local records for retry.
- D1 metadata and Worker secrets share a provider. Database exports still cannot
  decrypt records alone, but this no longer provides separation of providers.

## Repeatable copy

Keep all exports and generated SQL outside Git, in a protected directory on
persistent storage or an external backup. Both contain private account data.
First test against local D1, then the remote database before routing app traffic.

```bash
pnpm exec convex export --prod --path /protected/convex.zip
python3 scripts/migrate-convex-to-d1.py /protected/convex.zip \
  --analytics /protected/old-analytics-snapshot.json --sql /protected/import.sql
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler d1 execute DB --remote --file /protected/import.sql
python3 scripts/migrate-convex-to-d1.py /protected/convex.zip --verify
```

For the final frozen copy, use prepared REST batches rather than another bulk
SQL import. Cloudflare returned `D1_RESET_DO` on the large final SQL file during
the production migration. Prepared parameters avoid oversized SQL statements;
unchanged workspace records are skipped to preserve edit history and reduce
writes. The script refuses this path if D1 already contains login sessions.
Use a D1 API token from the environment or an existing protected Wrangler OAuth
configuration; never put a token in a command argument.
The copy script requires Python 3.11 or newer. Run its isolated SQLite/API tests
with `python3 scripts/test-migrate-convex-to-d1.py`.

```bash
python3 scripts/migrate-convex-to-d1.py /protected/convex-final.zip \
  --apply-remote --source-frozen \
  --account-id YOUR_ACCOUNT_ID --database-id YOUR_DATABASE_ID \
  --oauth-config /protected/wrangler/config/default.toml
python3 scripts/migrate-convex-to-d1.py /protected/convex-final.zip --verify
```

The importer verifies every user id, provider identity, ciphertext field and
wrapped key. It is idempotent only **before cutover**: it also reconciles source
deletions. Never re-import over a live D1 workspace.

Before the final copy, freeze the archived Convex workspace using its
`KLIPCODE_MIGRATED=true` environment guard. A stale browser then keeps its
unsynced changes locally until it reloads and signs in to the D1 version.
Disable the old VPS deploy timer and protect the production Worker from old
automatic deploy commands until the migration branch is published. Add the
new GitHub return URL before deploying; remove the old URL after validation.

## Rollback

Before D1 accepts user writes, restore the recorded pre-migration Worker
version, old GitHub callback and unset `KLIPCODE_MIGRATED` in Convex. Source data
is preserved. After D1 accepts writes, **do not switch back directly**: freeze D1
writes, export it, reconcile new records/deletions into the source, and verify
before restoring traffic. Worker rollback alone cannot roll database state back.

Convex code remains archived solely for the source freeze, verification and
rollback. It is not part of the deployed app backend. Remove the legacy project
and credentials only after the backup retention window and explicit approval.

## Production cutover on 2026-09-30

The verified final export contains 14 users, 14 GitHub identities, 13 wrapped
keys, 43 folders and 302 snippets. App version
`6682cee2-f690-4748-a1d8-957e1fcbc996` and console version
`bf260137-d3d4-483c-8f59-934723ad4a04` completed the cutover. Production checks
confirmed GitHub sign-in resolves to an imported user, existing encrypted fields
decrypt, and encrypted create/edit/delete succeeds. The old GitHub callback was
removed and the Convex source remains frozen for recovery.

The production Cloudflare build command currently uploads a version without
activating traffic. Once this migration is published to the production branch,
restore the deploy command to `pnpm deploy`, which applies D1 migrations before
building and deploying. Do not restore automatic activation while the branch
still contains the old Convex application. The VPS origin, tunnel and deploy
timer are disabled; infrastructure provisioning also keeps them disabled.

The private console polls a single revision row every ten seconds while visible,
then loads cached metadata when the revision changes. It never reads ciphertext
for analytics and makes no Convex requests.

## Legacy timestamp compatibility

Imported records retain ISO timestamps with explicit offsets such as
`2026-07-16T11:04:39.716+00:00`, including variable fractional precision. The
backend accepts those alongside `Z` timestamps, preserves their original values,
and compares update timestamps by instant for last-write-wins. Version
`1f3b6e7d-69df-4ee1-b2a0-d08ba7bdabbf` fixes the initial validation regression
that rejected edits to these records. A real D1 regression test covers the
imported format and stale writes with a different UTC offset.
