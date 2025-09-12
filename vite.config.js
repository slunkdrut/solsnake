import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      '34e43099d172.ngrok-free.app'
    ]
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
