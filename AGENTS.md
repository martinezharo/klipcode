<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KlipCode | Project Specification & Instructions
Description: Multi-device code snippet management web application. Focus on input speed, aesthetic minimalism (Vercel style), and invisible synchronization.

## 1. Technology Stack
- Framework: Next.js (App Router).

- Styling: Tailwind CSS (Dark mode by default).

- Editor: CodeMirror 6 (@uiw/react-codemirror).

- Database: Supabase (PostgreSQL + GitHub Auth).

- Local Persistence: IndexedDB via Dexie.js.

- Sync/State: TanStack Query (React Query).

- Deployment: Dokploy.

- Package Manager: PNPM.

## 2. Business Rules & Flow

- Auto-save: The editor has no "Save" button. Uses debounce (800ms) to sync with Supabase.

- Sync States: Display visually in the editor: Changing... (local input), Saving... (request in progress), Saved to cloud (success).

- Session Migration: If data exists in localStorage/IndexedDB at GitHub login, automatically import it to the user's cloud profile.

- Performance: Home shows read-only previews (use static highlighting or CodeMirror in readOnly mode). Full editor instance only on snippet open.

- User-visible text must never be hardcoded; store in i18n for translation support.

## 3. Style Guide (UI/UX)
- Aesthetics: Minimalist, professional, dark theme by default. Inspired by Vercel/Linear.

- Fonts: Cascadia Code (with ligatures enabled) for code blocks.

- Theme: 'VS Code Dark' for code blocks.

- Palette: Background #0a0a0a, borders #262626 (or white/10), accents in pure white or soft gray.

- Components: Fully custom menus and selects (avoid native HTML).
