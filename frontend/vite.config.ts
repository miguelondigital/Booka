import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server:{
    proxy: {
      '/api':{
        target: 'http://localhost:5000', // Backend server
        changeOrigin: true, // Ensure request appears to come from the frontend server
        rewrite: (path) => path.replace(/^\/api/, ''), // Removes '/api' prefix
      }
    }
  },
})
