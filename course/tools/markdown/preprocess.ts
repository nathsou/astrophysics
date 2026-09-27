import type { PreprocessorGroup } from 'svelte/compiler';
import { compileMarkdown } from './compile.ts';

/** Svelte preprocessor that turns course Markdown (.md) into Svelte components. */
export function markdown(): PreprocessorGroup {
  return {
    name: 'course-markdown',
    async markup({ content, filename }) {
      if (!filename?.endsWith('.md')) return;
      return compileMarkdown(content, filename);
    },
  };
}
