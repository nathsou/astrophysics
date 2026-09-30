import type { PreprocessorGroup } from 'svelte/compiler';
import { compileMarkdown } from './compile.ts';

type Compile = typeof compileMarkdown;
interface DevServer {
  ssrLoadModule(url: string): Promise<Record<string, unknown>>;
}

/**
 * In `vite dev`, vite.config.ts registers its server here. The compiler is then loaded through
 * Vite's module graph, which reloads it whenever a file in tools/markdown/ changes. (A plain import
 * is cached by Node for the life of the process, even across Vite restarts.)
 */
export function useDevServer(server: DevServer): void {
  (globalThis as { __lmMarkdownServer?: DevServer }).__lmMarkdownServer = server;
}

async function compiler(): Promise<Compile> {
  const server = (globalThis as { __lmMarkdownServer?: DevServer }).__lmMarkdownServer;
  if (!server) return compileMarkdown;
  const mod = await server.ssrLoadModule('/tools/markdown/compile.ts');
  return mod.compileMarkdown as Compile;
}

/** Svelte preprocessor that turns course Markdown (.md) into Svelte components. */
export function markdown(): PreprocessorGroup {
  return {
    name: 'course-markdown',
    async markup({ content, filename }) {
      if (!filename?.endsWith('.md')) return;
      return (await compiler())(content, filename);
    },
  };
}
