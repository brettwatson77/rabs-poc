import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3008,
    proxy: {
      '/api': {
        // Explicit IPv4 loopback avoids localhost/IPv6 quirks
        target: 'http://127.0.0.1:3009',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
