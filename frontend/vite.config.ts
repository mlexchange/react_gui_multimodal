import path, { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import * as packageJson from "./package.json";

/** @type {import('vite').UserConfig} */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../", "SCATTERING_");

  const tiledUrl = env.SCATTERING_TILED_URL || "http://localhost:8000";
  const tiledApiKey = env.SCATTERING_TILED_API_KEY || "";
  const tiledCalibrationUrl = env.SCATTERING_TILED_CALIBRATION_URL || "";
  const tiledCalibrationApiKey = env.SCATTERING_TILED_CALIBRATION_API_KEY || "";

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    define: {
      "import.meta.env.SCATTERING_TILED_URL": JSON.stringify(tiledUrl),
      "import.meta.env.SCATTERING_TILED_API_KEY": JSON.stringify(tiledApiKey),
      "import.meta.env.SCATTERING_TILED_CALIBRATION_URL":
        JSON.stringify(tiledCalibrationUrl),
      "import.meta.env.SCATTERING_TILED_CALIBRATION_API_KEY": JSON.stringify(
        tiledCalibrationApiKey
      )
    },
    plugins: [
      react(),
      dts({
        include: ["src/"],
        exclude: ["src/app/", "src/main.tsx"]
      })
    ],
    optimizeDeps: {
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: "globalThis"
        }
      }
    },
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "MultimodalAnalysis",
        formats: ["es", "umd"],
        fileName: (format) => `multimodal.${format}.js`
      },
      rollupOptions: {
        external: [...Object.keys(packageJson.peerDependencies)],
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM"
          }
        }
      }
    },
    server: {
      port: 4000,
      host: "0.0.0.0",
      proxy: {
        // This forwards API requests to your backend during development
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true
          // Optional: remove '/api' prefix when forwarding to backend
          // rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
});
