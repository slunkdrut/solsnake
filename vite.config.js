import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',   // ✅ works on Netlify & Vercel
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
