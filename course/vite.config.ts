import { sveltekit } from '@sveltejs/kit/vite';
import { useDevServer } from './tools/markdown/preprocess.ts';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serve the Markdown compiler through Vite's module graph in dev, so edits to tools/markdown/ apply
 * immediately; then reload pages that use it.
 */
function markdownDevCompiler(): Plugin {
  return {
    name: 'markdown-dev-compiler',
    apply: 'serve',
    configureServer(server) {
      useDevServer(server);
      server.watcher.on('change', (file) => {
        if (!file.includes('/tools/markdown/')) return;
        // Invalidate every compiled .md module so pages recompile with the new compiler.
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          if (mod.id?.endsWith('.md')) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), markdownDevCompiler()],
  server: {
    fs: { allow: ['..'] },
    watch: { ignored: ['**/build/**'] },
  },
  worker: { format: 'es' },
});
