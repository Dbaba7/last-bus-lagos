import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy: {
    '/matchmake': 'http://127.0.0.1:2567',
    '/health': 'http://127.0.0.1:2567',
    '/api': 'http://127.0.0.1:2567'
  } },
  build: { outDir: '../../dist/client', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1600 }
});
