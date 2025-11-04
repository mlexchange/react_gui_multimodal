import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

/** @type {import('vite').UserConfig} */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', 'SCATTERING_');

  const tiledUrl = env.SCATTERING_TILED_URL || 'http://localhost:8000';
  const tiledApiKey = env.SCATTERING_TILED_API_KEY || '';

  return {
    define: {
      'import.meta.env.SCATTERING_TILED_URL': JSON.stringify(tiledUrl),
      'import.meta.env.SCATTERING_TILED_API_KEY': JSON.stringify(tiledApiKey),
    },
    plugins: [react()],
    optimizeDeps: {
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis',
        },
        // Enable esbuild polyfill plugins
        plugins: [
          NodeGlobalsPolyfillPlugin({
            buffer: true,
          }),
          NodeModulesPolyfillPlugin(),
        ],
      },
    },
    build: {
      rollupOptions: {
        plugins: [
          NodeGlobalsPolyfillPlugin({
            buffer: true,
          }),
          NodeModulesPolyfillPlugin(),
        ],
      },
    },
    server: {
      port: 4000,
      host: '0.0.0.0',
      proxy: {
        // This forwards API requests to your backend during development
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          // Optional: remove '/api' prefix when forwarding to backend
          // rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
  }
});
