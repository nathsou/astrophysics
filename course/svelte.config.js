import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { markdown } from './tools/markdown/preprocess.ts';

/** @type {import('@sveltejs/kit').Config} */
export default {
  extensions: ['.svelte', '.md'],
  preprocess: [markdown(), vitePreprocess()],
  kit: {
    adapter: adapter({ fallback: '404.html', strict: true }),
    // GitHub Pages serves project sites from /<repo>/; the deploy workflow sets BASE_PATH.
    paths: { base: process.env.BASE_PATH ?? '' },
    prerender: { handleHttpError: 'warn', handleMissingId: 'warn', handleUnseenRoutes: 'ignore' },
    alias: {
      $content: 'content',
      $tools: 'tools',
    },
  },
};
