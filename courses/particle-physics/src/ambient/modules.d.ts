// Ambient declarations shared by svelte-check and the repo-root tsc check.
declare module '*.md' {
  import type { Component } from 'svelte';
  const component: Component<any>;
  export default component;
  export const metadata: import('$lib/content/types').ChapterMetadata;
  export const toc: import('$lib/content/types').TocEntry[];
  export const terms: Record<string, import('$lib/content/types').TermDef>;
  export const references: import('$lib/content/types').Reference[];
  export const glossary: Record<string, import('$lib/content/types').GlossaryEntry>;
}
