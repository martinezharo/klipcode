# KlipCode

KlipCode is a cloud-synced code snippet manager that keeps your code available
wherever you work. Start immediately without an account, then sign in with
GitHub to securely save your library and access it across all your devices.

## Features

- Automatic cloud synchronization across devices.
- Account-free guest workspace for getting started immediately.
- Fast saving and access to snippets.
- Folder-based organization with multiple nesting levels.
- Drag-and-drop to move folders and snippets.
- Quick copy-to-clipboard.
- Editor with automatic saving.
- Pinned snippets in the home view and sidebar.
- UI text is internationalized (i18n).

## Technologies

- Next.js 16 (App Router).
- React 19.
- Tailwind CSS v4.
- CodeMirror 6.
- Dexie.js for the guest workspace and local working copy.
- Convex for the backend: data, functions, and authentication.
- TanStack Query for remote state management.

## Requirements

- Node.js 20 or newer.
- pnpm.
- A Convex project for cloud sync and authentication.

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Start the Convex backend (writes `.env.local` and watches `convex/`):

```bash
pnpm dev:backend
```

3. In a second terminal, start the development server:

```bash
pnpm dev
```

4. Open http://localhost:3000 in your browser.

## Environment variables

`pnpm dev:backend` writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into
`.env.local`, so cross-device sync needs no manual configuration.

Two secrets are set by hand — see [.env.example](.env.example):

```bash
# Cloudflare (.env / .dev.vars / wrangler secret): wraps every per-user key.
ENCRYPTION_MASTER_KEY=
# Optional: the public site URL.
NEXT_PUBLIC_SITE_URL=
```

GitHub sign-in needs an OAuth app, whose credentials live on the Convex
deployment (never in the client bundle):

```bash
npx convex env set AUTH_GITHUB_ID <client-id>
npx convex env set AUTH_GITHUB_SECRET <client-secret>
```

If no deployment is configured, the guest workspace remains available on the
current device, but sign-in and cross-device access are disabled.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:watch
pnpm test:e2e
pnpm dev:backend
```

## Backend

The backend lives in [convex/](convex) and is the schema, the API, and the
authorization rules in one place:

- [convex/schema.ts](convex/schema.ts) — tables for folders, snippets, and the
  per-user wrapped encryption keys.
- [convex/workspace.ts](convex/workspace.ts) — the sync endpoints. Ownership is
  taken from the authenticated identity and never from the payload, which is
  what replaced per-table row-level security.
- [convex/lib/hierarchy.ts](convex/lib/hierarchy.ts) — folder-cycle rejection
  and the delete cascade, covered by
  [convex/workspace.test.ts](convex/workspace.test.ts).

The encryption master key is deliberately NOT a Convex environment variable: it
stays on Cloudflare in [/api/crypto/dek](src/app/api/crypto/dek/route.ts), so a
dump of the deployment holds only ciphertext and wrapped keys.

## Project structure

- [src/app](src/app) contains the main Next.js entry.
- [src/components](src/components) holds the application UI components.
- [src/hooks](src/hooks) contains auth, mutation, and sync logic.
- [src/lib](src/lib) groups data access, types, and utilities.
- [src/i18n](src/i18n) centralizes user-facing text for translations.

## Quick start

1. Create a snippet from the main screen or from the sidebar.
2. Organize it into a folder or move it using drag-and-drop.
3. Sign in with GitHub to save your library to KlipCode and access it across
   devices.
4. Edit the code and let auto-save keep your library synchronized.

## Deployment

Cloudflare Workers Builds compiles the app on push. Two things make that work,
and they live in different places for a reason:

- `NEXT_PUBLIC_CONVEX_URL` is inlined into the client bundle **at build time**,
  so it is committed in [.env.production](.env.production). Setting it as a
  Worker runtime variable has no effect — by then the bundle is already
  compiled, and the app would silently fall back to a device-only guest
  workspace.
- `ENCRYPTION_MASTER_KEY` is read per request by the DEK route, so it is a
  Worker **secret** (`wrangler secret put ENCRYPTION_MASTER_KEY`) and is never
  committed.

Also set `NEXT_PUBLIC_SITE_URL`, and push the backend with `npx convex deploy`
when the functions in `convex/` change (`pnpm deploy` does both if you are
deploying from a local checkout instead).
