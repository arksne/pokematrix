import { defineConfig } from 'vite'

export default defineConfig({
  base: '/League17-tma/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
