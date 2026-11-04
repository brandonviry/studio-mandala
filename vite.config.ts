import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const tauriDevHost = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.TAURI_DEV_HOST;

export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [react()],
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    host: tauriDevHost ?? '127.0.0.1',
    port: 1420,
    strictPort: true,
    hmr: tauriDevHost
      ? {
          protocol: 'ws',
          host: tauriDevHost,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
