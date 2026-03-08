import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.spec.ts"],
    exclude: ["node_modules", ".next", "prisma", "tests"],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Global setup disabled for unit tests - only needed for integration tests
    // Run integration tests with: vitest run tests/integration
    // globalSetup: ["./tests/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
