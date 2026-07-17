import { defineConfig } from 'vite';

// Served from https://connectdistro.github.io/transroyal-frontend/ -- a
// project site lives under a repo-name subpath, not the domain root, so
// every Vite-processed asset URL needs that prefix baked in at build time.
export default defineConfig({
  base: '/transroyal-frontend/',
});
