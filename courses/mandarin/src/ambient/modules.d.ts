declare module '*.md' {
  import type { Component } from 'svelte';
  const component: Component;
  export default component;
  export const metadata: import('$lib/content/types').LessonMeta;
  export const toc: { id: string; text: string }[];
}
