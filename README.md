# KlipCode

KlipCode is a code snippet manager with local storage and optional cloud synchronization. It lets you quickly save, organize, and copy snippets, work with nested folders, and pin important items.

## Features

- Immediate local saving using IndexedDB.
- Cloud synchronization when Supabase is configured.
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
- Dexie.js for local persistence.
- Supabase for authentication and synchronization.
- TanStack Query for remote state management.

## Requirements

- Node.js 20 or newer.
- pnpm.
- Optional: a Supabase account to enable cloud sync.

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Start the development server:

```bash
pnpm dev
```

3. Open http://localhost:3000 in your browser.

## Environment variables

To use Supabase and enable cross-device synchronization, set the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

Optionally, set the public site URL:

```bash
NEXT_PUBLIC_SITE_URL=
```

If Supabase is not configured, the app continues to work locally using IndexedDB.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:watch
```

## Database

The Supabase schema is in [db-structure.sql](db-structure.sql). It includes tables for profiles, folders, and snippets, as well as the RLS policies required for per-user data.

## Project structure

- [src/app](src/app) contains the main Next.js entry.
- [src/components](src/components) holds the application UI components.
- [src/hooks](src/hooks) contains auth, mutation, and sync logic.
- [src/lib](src/lib) groups data access, types, and utilities.
- [src/i18n](src/i18n) centralizes user-facing text for translations.

## Quick start

1. Create a snippet from the main screen or from the sidebar.
2. Organize it into a folder or move it using drag-and-drop.
3. Edit the code and let the auto-save synchronize changes.
4. Sign in with GitHub to sync your snippets to the cloud.

## Deployment

The app can be deployed like any Next.js project. When publishing, be sure to configure `NEXT_PUBLIC_SITE_URL` and the Supabase environment variables for production.
