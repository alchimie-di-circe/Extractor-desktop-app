import { defineConfig } from "vite";
import path from "node:path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@electron": path.resolve(__dirname, "electron"),
    },
  },
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["es"],
      entry: "electron/preload.ts",
      fileName: "preload",
    },
    rollupOptions: {
      external: [
        "electron",
        "keytar",
        "electron-store",
        "node:path",
        "node:fs",
        "node:os",
      ],
    },
  },
});
