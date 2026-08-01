import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
    // Keep Vitest away from the Playwright specs in e2e/. The Convex backend
    // tests live next to the functions they cover and declare their own
    // (edge-runtime) environment via a docblock.
    include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.ts"],
  },
});
