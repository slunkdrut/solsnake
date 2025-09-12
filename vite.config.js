import { defineConfig } from 'vite'

export default defineConfig({
  base: '/solsnake/',   // 👈 required for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
