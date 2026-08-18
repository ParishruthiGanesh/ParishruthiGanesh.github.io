// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// User-site deployment: https://parishruthiganesh.github.io
// A user/organisation GitHub Pages site is served from the domain root, so the
// base path stays '/'. If this ever moves to a project page, set `base` here and
// every internal link (which routes through `src/lib/url.ts`) follows.
export default defineConfig({
  site: 'https://parishruthiganesh.github.io',
  base: '/',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
