import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

let buildCommit = 'dev'
try {
  buildCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() || 'dev'
} catch { /* вне git — останется dev, проверка свежести пропускается */ }

export default defineConfig({
  base: '/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
