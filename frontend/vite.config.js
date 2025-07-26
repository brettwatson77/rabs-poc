import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3008,
    strictPort: true,
    allowedHosts: [
      'rabspoc.codexdiz.com',
      'rabsp.codexdiz.com',
      '192.168.77.8',  // ← your VM’s IP
      'localhost'
  ],
  proxy: {
    '/api': {
      target: 'http://192.168.77.8:3009', // ← backend on the Linux box
      changeOrigin: true,
      secure: false
    }
   }
  }
});
