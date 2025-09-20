import { defineConfig } from 'vite'

// Dev-only middleware to prevent the browser from loading serverless files under /api/*
// This avoids Vite trying to transform `api/state.js` in the browser during `vite` dev.
function devApiStub() {
  const enabled = process.env.VITE_USE_API_STORAGE !== '1';
  return {
    name: 'dev-api-stub',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url.startsWith('/api/state')) {
          res.statusCode = 501;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Local dev: API disabled. Set VITE_USE_API_STORAGE=1 and run a functions server.' }));
          return;
        }
        if (req.url.startsWith('/api/time')) {
          res.statusCode = 404; // let client fall back to local time logic
          res.end();
          return;
        }
        next();
      });
    }
  }
}

export default defineConfig({
  base: '/',   // ✅ works on Netlify & Vercel
  plugins: [devApiStub()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
