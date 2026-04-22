import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8001"
    }
  },
  build: {
    outDir: "dist/client",
    assetsDir: "static",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts"
  }
});
