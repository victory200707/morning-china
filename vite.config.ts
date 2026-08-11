import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-web",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
