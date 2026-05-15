import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.RAILWAY_ENVIRONMENT || process.env.RENDER ? '/' : '/League17-tma/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
