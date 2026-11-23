import { defineConfig } from 'vite';

// Relative base: the same build works at a domain root and under a sub-path,
// which is where GitHub Pages serves a project site (/typing_trainer/).
// In development /api goes to the Worker run by `npx wrangler dev --port 8787`; the Host
// header is kept, so the Worker sees the page's own origin and its origin check passes.
export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', ws: true },
    },
  },
});
