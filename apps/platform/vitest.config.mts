import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" throws outside a React Server Components build.
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Expose .env.local to integration tests (Vite only loads VITE_* by default).
    env: loadEnv(mode, process.cwd(), ""),
    // Integration tests talk to the dev Supabase project; give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
