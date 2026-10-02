import { defineConfig } from 'vite';
export default defineConfig({ server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001', '/health': 'http://127.0.0.1:3001' } }, preview: { port: 4173, strictPort: true } });
