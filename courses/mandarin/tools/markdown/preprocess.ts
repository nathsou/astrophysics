/** Svelte preprocessor: compiles lesson Markdown (.md) into Svelte components. */
import type { PreprocessorGroup } from 'svelte/compiler';
import { compileLesson } from './compile.ts';

export function markdown(): PreprocessorGroup {
  return {
    name: 'lesson-markdown',
    markup({ content, filename }) {
      if (!filename?.endsWith('.md')) return;
      return { code: compileLesson(content, filename) };
    },
  };
}
