# KlipCode

KlipCode is a web app for saving, organizing, and copying code snippets. It is
a lightweight, minimalist alternative to Notion for developers: sign in with
GitHub to keep your library synced across devices, or start straight away in a
guest workspace that stays on the device you are using.

## Features

- Create, edit, search, copy, and organize snippets in nested folders.
- Move snippets and folders with drag and drop, pin items to the sidebar or the
  home view, and restore deleted items from the trash.
- Edit code in a CodeMirror editor with syntax highlighting for the supported
  languages, auto-save, and on-demand formatting through Prettier's standalone
  build.
- Write and preview Markdown documents in a rich TipTap editor.
- Generate a name for an untitled snippet with Workers AI (Llama 3.2 3B
  Instruct) when signed in.
- Sync the library through Cloudflare D1 after GitHub sign-in. Cloud records
  are encrypted per user using the existing `ENCRYPTION_MASTER_KEY` Worker
  secret. Missing keys fail closed rather than uploading plaintext.
  A device downloads the whole library once, then only what changed since its
  last sync (a server-clock cursor), which keeps D1 database I/O small.
- Use the app in English or Spanish, in light or dark theme, with keyboard
  shortcuts and a search palette. A service worker caches the app shell so the
  UI still loads offline.

## Tech stack

Next.js 16 (App Router, React 19) and Tailwind CSS 4, deployed as a Cloudflare
Worker through OpenNext. D1 stores the workspace and Auth.js database sessions;
GitHub provides authentication. Local snippet storage uses IndexedDB via Dexie.
The private analytics console uses the same D1 database without a VPS.

## Requirements

- Node.js 22 (the version CI uses).
- pnpm 10 (the repository pins pnpm 10.11.1).

## Development

Install dependencies and start the Next.js development server:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. This is enough to work on the guest workspace.

To develop cloud sync, copy [.dev.vars.example](.dev.vars.example) to
`.dev.vars`, fill in a development OAuth app and encryption key, then run:

```bash
pnpm dev:backend
pnpm dev
```

`pnpm dev:backend` applies D1 migrations locally. The GitHub callback is
`http://localhost:3000/api/auth/callback/github` for development and
`https://klipcode.com/api/auth/callback/github` for production. Use separate
OAuth applications for these environments. Missing OAuth credentials leave
the guest workspace available.

Production uses `DB` as a D1 binding and Worker secrets `AUTH_SECRET`,
`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL` and
`ENCRYPTION_MASTER_KEY`. Never replace the production master key: existing
wrapped keys and ciphertext depend on it. `pnpm deploy` applies versioned D1
migrations before building and deploying the Worker.

## Checks and scripts

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm preview
```

CI runs all of the above on every push to `main` and on every pull request.
`pnpm preview` uses the Cloudflare/OpenNext build path.

## Further reading

- [Engineering audit](docs/audit/engineering-audit.md)
- [D1 backend](src/server/)
- [Migration and rollback](docs/d1-migration.md)
- [Environment example](.env.example)

KlipCode is released under the [MIT License](LICENSE).
