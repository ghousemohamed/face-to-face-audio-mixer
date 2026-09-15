import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.BACKEND_ORIGIN ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    hmr: process.env.VITE_HMR_HOST
      ? { protocol: 'wss', host: process.env.VITE_HMR_HOST, clientPort: 443 }
      : true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/recordings': { target: BACKEND, changeOrigin: true },
      '/health': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND.replace(/^http/, 'ws'), ws: true },
    },
  },
});
