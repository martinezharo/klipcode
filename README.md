# KlipCode

KlipCode is a local-first code snippet manager. Start without an account, keep
working in a device-local workspace, and sign in with GitHub when you want your
library available across devices.

## Highlights

- Create, edit, search, copy, and organize snippets in nested folders.
- Move snippets and folders with drag and drop, and pin important items to the
  sidebar or home view.
- Use a multi-language editor with syntax highlighting, auto-save, and a rich
  Markdown preview.
- Optionally generate names for untitled snippets with AI when signed in.
- Sync a library through Convex after GitHub sign-in. Cloud records use
  per-user encryption when the Cloudflare Worker `ENCRYPTION_MASTER_KEY` is
  configured; without that secret, the current plaintext compatibility mode is
  used.
- Use the interface in English or Spanish.

## Requirements

- Node.js 20 or newer.
- pnpm 10 (the repository pins pnpm 10.11.1).

## Development

Install dependencies and start the Next.js development server:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. This is enough for the device-local workspace.

To develop cloud sync and authentication, run the Convex development backend
in a second terminal before starting the app:

```bash
pnpm dev:backend
pnpm dev
```

`pnpm dev:backend` writes the development deployment values to `.env.local`.
For encrypted local cloud records, copy [.env.example](.env.example) to `.env`
and set `ENCRYPTION_MASTER_KEY`. GitHub sign-in also requires a GitHub OAuth app
and these Convex environment variables:

```bash
pnpm exec convex env set AUTH_GITHUB_ID <client-id>
pnpm exec convex env set AUTH_GITHUB_SECRET <client-secret>
```

## Checks and scripts

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm preview
```

`pnpm preview` uses the Cloudflare/OpenNext build path. `pnpm deploy` also
deploys the Convex backend before publishing the Worker.

## Deployment

KlipCode is deployed as a Cloudflare Worker using OpenNext. Configure the
bindings in [wrangler.jsonc](wrangler.jsonc), set `ENCRYPTION_MASTER_KEY` as a
Worker secret, and run:

```bash
pnpm deploy
```

## Further reading

- [Engineering audit](docs/audit/engineering-audit.md)
- [Convex backend](convex/)
- [Environment example](.env.example)

KlipCode is released under the [MIT License](LICENSE).
