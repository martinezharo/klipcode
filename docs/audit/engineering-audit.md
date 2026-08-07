# Engineering Audit

**Audit date:** 2026-08-07  
**Scope:** application code, Convex functions, local persistence, cloud sync, authentication, API routes, dependency graph, accessibility-sensitive UI paths, and a production-style browser smoke test.

## Executive summary

The audit found and fixed several correctness, isolation, accessibility, and performance issues without changing the product model. The fixes were pushed incrementally to [PR #21](https://github.com/martinezharo/klipcode/pull/21).

No critical unresolved vulnerability was found in the reviewed code paths. The items below remain intentionally open because resolving them requires choosing a product or architecture policy rather than applying a mechanically safe fix.

## Remediated findings

- `6b4b500` fixed the locale rewrite redirect loop, corrected keyboard navigation for snippet cards, and removed invalid Tailwind arbitrary-value patterns that generated CSS warnings.
- `5f29877` rejected duplicate client IDs, preserved valid folder graphs during stale sync retries, used UTF-8 batch sizing, and stopped oversized records from retrying forever.
- `f48a3cc` isolated local mutations by account, fixed account-switch reconciliation races, and capped streamed AI-title request bodies at 128 KiB.
- `c071635` centralized clipboard handling, indexed the workspace tree to avoid repeated O(n²) scans, and added accessible folder expand/collapse controls.
- `1f03ada` refreshed the stable Cloudflare/Next build toolchain and replaced render-time ref mutations with an effect-safe reusable `useLatestRef` hook. It also removed an effect-based search reset in favor of the input event.
- `739fd6d` clears the in-memory encryption key immediately after a successful sign-out, before IndexedDB cleanup can fail. It also preserves the API's `413` response if stream cancellation rejects.
- `91f79c0` fixed manual `mailto:` link validation and added coverage for accepted and rejected schemes.
- Removed the server-side Open Graph renderer and isolated the browser-owned workspace behind a client-only entry point. This keeps the editor's CodeMirror, lowlight, and optional Prettier graph out of the Cloudflare Worker while retaining static social metadata.

## Findings intentionally deferred

These are not forgotten bugs. Each one needs an explicit policy before implementation so that a local fix does not silently choose behavior for users.

### 1. Editor conflicts and last-write-wins semantics — medium data-loss risk

`SnippetEditor` initializes its local code state from the snippet once. A remote pull can update the IndexedDB/query record while the same snippet remains open; the editor can then continue from its older local buffer and write it back. The sync layer also deliberately uses client-authored `updatedAt` last-write-wins.

The product decision is whether to keep last-write-wins, merge text, show a conflict state, or version edits. The choice affects the editor UI, local schema, sync protocol, and recovery behavior.

### 2. Client clocks are the conflict authority — medium integrity risk

`updatedAt` is minted by clients. A device with a badly skewed or deliberately future clock can win subsequent comparisons and make another device's edits appear stale. Moving to server timestamps, logical clocks, or a hybrid policy would change offline behavior and migration semantics.

### 3. Legacy-record adoption needs an ownership/consent policy — high privacy sensitivity

`adoptLegacyRecords()` takes records whose old owner ID is not the current Convex user and assigns them to the first account that signs in after migration. The one-time local flag prevents a second account from taking them later, but a crash after the flag is written can leave records invisible and unadopted.

The unresolved decision is whether first-account takeover is acceptable on shared devices, or whether the app needs an explicit migration prompt, account-selection step, backup, and retryable migration journal.

### 4. Anonymous seed behavior after cloud-query failure — medium data-integrity risk

`accountHasCloudContent()` and the seed checks treat a failed cloud query as “no known cloud content.” This intentionally favors not destroying local data, but it can claim or duplicate welcome content after a transient outage. Choosing fail-closed, fail-open, or a pending-confirmation state is a product/data-safety decision.

### 5. Encryption fallback and key recovery — high security/product sensitivity

When the encryption endpoint is absent or the master key is not configured, sync intentionally falls back to plaintext version `0` for backward compatibility. Other key-fetch failures remain transient and do not downgrade. The app also keeps each user's DEK immutable.

The deployment must choose whether encryption-unavailable mode should eventually fail closed, how existing plaintext records are migrated, and how key rotation, account recovery, and loss of the Cloudflare master secret are handled. Changing this without a migration plan can make existing records unreadable.

### 6. Workspace scale and sync protocol — medium performance risk

`convex/workspace.list` returns the entire account and the mutations collect the account's full folder/snippet sets to validate hierarchy and deletes. This is simple and correct for the current lightweight workspace, but it has no pagination, incremental cursor, hard row limit, or server-side payload budget beyond mutation batching.

The next step depends on the target workspace size: paginated snapshots, change feeds, per-folder reads, or a server-enforced quota should be selected together with UX for partial loading.

### 7. Tombstone key shape — low-probability data-loss risk

The local tombstone store uses `id` as its primary key while each record also has a `kind` (`folder` or `snippet`). A folder UUID and snippet UUID collision would overwrite one deletion queue entry. A compound `kind,id` key would be safer, but changing it requires a Dexie migration and a decision about how to migrate existing tombstones.

### 8. AI-title abuse controls — medium operational/cost risk

The request body is capped and the prompt input is truncated, but the endpoint has no explicit per-user/IP rate limit, quota, or budget policy. Adding one requires choosing limits, authenticated identity versus IP keys, user-facing errors, and the deployment's durable rate-limit store.

### 9. Shared-tab/session architecture — medium privacy risk

The current auth race is covered against account changes during reconciliation, and sign-out now clears the in-memory key before local cleanup. IndexedDB and in-memory sync state are still shared by tabs, however. Stronger cross-tab locking, broadcast invalidation, and a per-user transaction boundary should be designed together if multi-account/multi-tab use becomes a supported workflow.

### 10. Nested interactive semantics in folder cards — accessibility refactor

`FolderCard` uses an `article` with `role="button"` and contains pin/more-action buttons. Event propagation is guarded, but some assistive technologies can treat descendants of a button-like role as non-interactive. Fixing this cleanly means choosing between a dedicated open button region and a non-interactive card container, then preserving drag, selection, and keyboard behavior.

## Dependency review

Before the stable refresh, `pnpm audit --prod` reported 43 vulnerabilities. After updating OpenNext to `1.20.2`, Next and `eslint-config-next` to `16.2.11`, and Wrangler to `4.110.0`, it reports 11 vulnerabilities: 5 high and 6 moderate.

The remaining paths are transitive:

- `linkify-it` through Tiptap/ProseMirror/Markdown-It (patched in `5.0.2`), including a quadratic `mailto:` validator issue.
- `sharp` through Wrangler/Miniflare (patched in `0.35.0`).
- `postcss` through Next (the current Next 16.2.11 graph still resolves vulnerable 8.4.x ranges for the reported advisories).
- `undici` through Wrangler/Miniflare (patched in `7.29.0`).

The stable upgrade was kept deliberately bounded. A newer Wrangler line brings an alpha Miniflare dependency, and moving to a later Next minor changes the framework/build graph. Overrides or alpha adoption should be made only after a compatibility decision and a Cloudflare preview test.

## Verification evidence

At the end of this audit:

- `pnpm test`: 15 files, 169 tests passed.
- `pnpm lint`: passed with no warnings or errors.
- `pnpm exec tsc --noEmit`: passed.
- `NEXT_TELEMETRY_DISABLED=1 KLIPCODE_REMOTE_BINDINGS=false pnpm exec next build`: passed. The only build warning is Next's framework notice that the `middleware` filename convention is deprecated in favor of `proxy`.
- Cached Playwright/Chromium smoke test: `/en/app` and `/es/app` returned `200`, localized titles/content were present, the locale URL normalized correctly, and no page/request errors were recorded. The English workspace interaction opened the Root control and found zero unlabeled non-hidden buttons.
- Cloudflare-specific local validation: `pnpm exec opennextjs-cloudflare build`, `pnpm exec wrangler deploy --dry-run`, and the OpenNext Wrangler preview all passed. After the bundle fix, `pnpm exec wrangler versions upload --dry-run` reported `1,191.77 KiB` gzip (down from `3,691.46 KiB`), with the Worker comfortably below the free 3 MiB script limit. The preview served both localized routes with `200` responses, verified the static social image, loaded the client-only workspace, and recorded no browser errors.
- T3 collaborative preview was unavailable in this environment; `preview_status` and `preview_open` both returned an explicit unavailable-host result, so the isolated cached-browser run was used instead.

## External Workers Build follow-up

The dependency-bearing PR SHA `2f4c1d8` and the documentation-only follow-up `1ec3b6a` both passed the repository's GitHub `verify` check, but the external `Workers Builds: klipcode` check reported `FAILURE` for each. The same Workers Build check passed at `f48a3cc` and began failing after the dependency/toolchain refresh.

The supplied Cloudflare log identified the failure precisely: installation and the OpenNext build completed, but `wrangler versions upload` rejected the generated Worker with error `10027` because the free plan's 3 MiB script limit was exceeded. The generated handler was listed at `17,129.60 KiB`; the upload also included the `next/og` Resvg WASM renderer (`1,346.05 KiB`) and produced a `4,512.26 KiB` gzip upload. The duplicate-case warning in generated code was non-fatal.

The fix removes the dynamic `next/og` routes in favor of the existing static landing image and renders the authenticated, IndexedDB-owned workspace through a client-only entry point. The latter prevents the editor's server graph from pulling CodeMirror, lowlight, and the optional Prettier formatter into the Worker. The local dry-run now reports `1,191.77 KiB` gzip and no longer contains those dependencies. This is a deployment-size correction, not a change to sync, encryption, or workspace data semantics.

Cloudflare's [Workers Builds API reference](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/) and [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) describe the separate build and deploy commands used by the connected trigger. The next push should be monitored for the external `Workers Builds: klipcode` result, because the local dry-run cannot replace Cloudflare's final account-limit validation.

Re-run `pnpm audit --prod` before release because advisory counts and transitive resolutions change independently of application code.
