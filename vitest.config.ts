import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Los tests de integración comparten la DB dev: archivos en serie.
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
