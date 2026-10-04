import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { markdown } from './tools/markdown/preprocess.ts';

/**
 * Base path: BASE_PATH if set, otherwise the collection's COURSES_BASE_PATH + /formal-verification when built from
 * the monorepo root (scripts/build.mjs), otherwise the domain root (local dev).
 */
const base = process.env.BASE_PATH ?? (process.env.COURSES_BASE_PATH !== undefined ? `${process.env.COURSES_BASE_PATH}/formal-verification` : '');

/** @type {import('@sveltejs/kit').Config} */
export default {
  extensions: ['.svelte', '.md'],
  preprocess: [markdown(), vitePreprocess()],
  kit: {
    adapter: adapter({ pages: 'dist', assets: 'dist', fallback: '404.html', strict: true }),
    paths: { base },
    prerender: { entries: ['*'], handleHttpError: 'warn', handleMissingId: 'warn', handleUnseenRoutes: 'ignore' },
    alias: {
      $content: 'content',
      $tools: 'tools',
    },
  },
};
