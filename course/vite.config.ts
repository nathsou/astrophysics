import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

/** The Markdown preprocessor is loaded once with svelte.config.js; restart when its source changes. */
function restartOnMarkdownTools(): Plugin {
  return {
    name: 'restart-on-markdown-tools',
    apply: 'serve',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.includes('/tools/markdown/')) void server.restart();
      });
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), restartOnMarkdownTools()],
  server: {
    fs: { allow: ['..'] },
    watch: { ignored: ['**/build/**'] },
  },
  worker: { format: 'es' },
});
