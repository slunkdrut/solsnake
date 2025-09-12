import { defineConfig } from 'vite'

export default defineConfig({
  base: '/solsnake/',   // 👈 GitHub Pages needs this
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
