import { defineConfig } from "vite";
// @ts-expect-error the development plugin is a Node module
import { socialDevPlugin } from "./scripts/social-dev.mjs";
// @ts-expect-error the development plugin is a Node module
import { assetDevPlugin } from "./scripts/asset-dev.mjs";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), socialDevPlugin(), assetDevPlugin()],
  // The SDK's browser bundle reads NODE_ENV through `process`; Vite does not
  // provide Node globals in the webview, so replace that expression at build time.
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
