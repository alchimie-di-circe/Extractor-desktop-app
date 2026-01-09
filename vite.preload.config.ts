import { defineConfig } from "vite";
import { builtinModules } from "module";
import path from "node:path";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["cjs"],
      entry: "electron/preload.ts",
      fileName: () => "preload.js", // Force .js extension
    },
    rollupOptions: {
      external: [
        "electron",
        "keytar",
        "electron-store",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    target: "esnext",
    minify: false,
    sourcemap: true,
    emptyOutDir: false, // Don't clear directory (shared with main)
  },
  resolve: {
    alias: {
      "@electron": path.resolve(import.meta.dirname, "electron"),
    },
    // Resolve Node.js-style imports
    conditions: ["node"],
  },
});
