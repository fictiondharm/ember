import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backend = env.VITE_BACKEND_ORIGIN ?? 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT ?? 5173),
      host: true,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT ?? 4173),
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    define: {
      // Lets the client talk to the backend on the same origin in dev/prod when
      // VITE_API_URL is not set (Vite proxies /api and /ws to the backend).
      __FLEETGRID_BACKEND__: JSON.stringify(env.VITE_API_URL ?? backend),
    },
  };
});
