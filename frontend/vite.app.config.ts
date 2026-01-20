import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite configuration for building the standalone application (Docker deployment).
 *
 * Usage: vite build --config vite.app.config.ts
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../", "SCATTERING_");

  const tiledUrl = env.SCATTERING_TILED_URL || "http://localhost:8000";
  const tiledApiKey = env.SCATTERING_TILED_API_KEY || "";

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    define: {
      "import.meta.env.SCATTERING_TILED_URL": JSON.stringify(tiledUrl),
      "import.meta.env.SCATTERING_TILED_API_KEY": JSON.stringify(tiledApiKey)
    },
    plugins: [react()],
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      }
    },
    build: {
      outDir: "dist-app",
      emptyOutDir: true
    },
    server: {
      port: 4000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true
        },
        "/ws": {
          target: "http://127.0.0.1:8000",
          ws: true
        }
      }
    }
  };
});
