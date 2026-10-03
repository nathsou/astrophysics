import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

/** Recompile lessons when the Markdown compiler changes during development. */
function markdownDevCompiler(): Plugin {
  return {
    name: 'markdown-dev-compiler',
    apply: 'serve',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!file.includes('/tools/markdown/')) return;
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
  },
});
