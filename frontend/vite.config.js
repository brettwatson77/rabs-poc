import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/', // ✅ Good for production builds
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3008,
    strictPort: true,
    allowedHosts: [
      'rabspoc.codexdiz.com',
      'rabsp.codexdiz.com',
      '192.168.77.6',
      'localhost'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3009',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
