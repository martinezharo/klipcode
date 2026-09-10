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
- Sync the library through Convex after GitHub sign-in. Cloud records are
  encrypted per user when the Cloudflare Worker secret `ENCRYPTION_MASTER_KEY`
  is set; without it, records are synced in plaintext (`cryptoVersion 0`).
- Use the app in English or Spanish, in light or dark theme, with keyboard
  shortcuts and a search palette. A service worker caches the app shell so the
  UI still loads offline.

## Tech stack

Next.js 16 (App Router, React 19) and Tailwind CSS 4, deployed as a Cloudflare
Worker through OpenNext. Convex provides the backend, the database, and GitHub
authentication; local snippet storage uses IndexedDB via Dexie.

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

To develop cloud sync and authentication, run the Convex development backend in
a second terminal before starting the app:

```bash
pnpm dev:backend
pnpm dev
```

`pnpm dev:backend` writes the development deployment values to `.env.local`.
For encrypted cloud records, copy [.env.example](.env.example) to `.env` and set
`ENCRYPTION_MASTER_KEY`. GitHub sign-in also requires a GitHub OAuth app and
these Convex environment variables:

```bash
pnpm exec convex env set AUTH_GITHUB_ID <client-id>
pnpm exec convex env set AUTH_GITHUB_SECRET <client-secret>
```

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

## Deployment

KlipCode is deployed as a Cloudflare Worker using OpenNext. Configure the
bindings in [wrangler.jsonc](wrangler.jsonc), set `ENCRYPTION_MASTER_KEY` as a
Worker secret, and run:

```bash
pnpm deploy
```

`pnpm deploy` deploys the Convex backend before publishing the Worker.

## Further reading

- [Engineering audit](docs/audit/engineering-audit.md)
- [Convex backend](convex/)
- [Environment example](.env.example)

KlipCode is released under the [MIT License](LICENSE).
