import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
const repo = '/home/user/courses/courses/particle-physics';
export default defineConfig({
  root: repo + '/.part8-harness',
  plugins: [svelte()],
  resolve: { alias: { $lib: repo + '/src/lib', '$app/paths': repo + '/.part8-harness/paths.ts' } },
  server: { fs: { allow: ['/'] }, port: 5239, strictPort: true },
  cacheDir: '/tmp/claude-0/-home-user-courses/089620dd-e749-5680-aba9-29b164475049/scratchpad/harness-cache',
});
