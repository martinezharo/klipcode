import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the `@/*` and `@convex/*` aliases from tsconfig.json. Native since
  // Vite 8, which replaced the vite-tsconfig-paths plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
    // Keep Vitest away from the Playwright specs in e2e/. The Convex backend
    // tests live next to the functions they cover and declare their own
    // (edge-runtime) environment via a docblock.
    include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.ts"],
  },
});
