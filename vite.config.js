import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      '34e43099d172.ngrok-free.app' // keep ngrok for testing
    ]
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  base: process.env.NODE_ENV === 'production' ? '/solsnake/' : '/'
})
