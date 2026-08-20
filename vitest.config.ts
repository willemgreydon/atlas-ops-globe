import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Node built-in; must not be bundled/transformed by Vite.
    server: { deps: { external: [/node:sqlite/] } },
  },
});
