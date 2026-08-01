# AGENTS.md
## Project
KlipCode is a web app for creating and storing code snippets, both privately on your local device and in the cloud, letting you sync your snippets across your devices.
More than an alternative to other code snippet tools, this project focuses on being a lightweight, minimalist alternative to Notion for developers.
This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.
## Product priorities
- Access and copy a snippet's content ASAP, with no friction.
- Create snippets ASAP, with no friction.
- Move through the app quickly and comfortably through excellent performance and UX.
- Modern, professional, clean UI inspired by Vercel and Linear.
## Architecture
The app is local-first: IndexedDB (Dexie, `src/lib/db.ts`) is the source of truth and always holds plaintext, so everything works offline. `src/lib/sync.ts` pushes and pulls against the cloud with last-write-wins on a client-authored `updatedAt`; only what crosses to the cloud is encrypted.

The backend is Convex, in `convex/`. Schema, API and authorization live together there — ownership comes from the authenticated identity inside each function, never from the request payload. Run `pnpm dev:backend` alongside `pnpm dev`; it regenerates `convex/_generated/`.

One deliberate exception: `/api/crypto/dek` stays a Cloudflare route rather than a Convex function, because it holds the master key that wraps each user's data key. Keeping it off Convex is what stops the encrypted records and the key that opens them from living with the same provider. Do not move it, and never set `ENCRYPTION_MASTER_KEY` as a Convex environment variable.

## Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.