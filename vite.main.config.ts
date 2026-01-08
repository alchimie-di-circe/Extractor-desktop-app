import { defineConfig } from "vite";
import { builtinModules } from "module";
import path from "node:path";

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  define: {
    // Inject forge-style constants for dev/prod
    MAIN_WINDOW_VITE_DEV_SERVER_URL:
      mode === "development" ? JSON.stringify("http://localhost:5173") : "undefined",
    MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
  },
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["es"],
      entry: "electron/main.ts",
      fileName: () => "main.js", // Force .js extension
    },
    rollupOptions: {
      external: [
        "electron",
        "electron-squirrel-startup",
        "keytar",
        "electron-store",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    target: "esnext",
    minify: false,
    sourcemap: true,
    emptyOutDir: false, // Don't clear directory (shared with preload)
  },
  resolve: {
    alias: {
      "@electron": path.resolve(import.meta.dirname, "electron"),
    },
    // Resolve Node.js-style imports
    conditions: ["node"],
  },
}));
