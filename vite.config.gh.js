import { defineConfig } from 'vite'

export default defineConfig({
  base: '/solsnake/', // 👈 important for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
