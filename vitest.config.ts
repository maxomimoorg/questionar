import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version?: string };

export default defineConfig({
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version || "unknown") },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
