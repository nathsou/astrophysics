// Declarations that only the repo-root tsc check needs; svelte-check gets these
// from SvelteKit's and Vite's own types.
declare module '*?raw' {
  const text: string;
  export default text;
}
declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<any>;
  export default component;
}
declare module '$app/paths' {
  export const base: string;
  export const assets: string;
}
declare module '$app/environment' {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
}
interface ImportMeta {
  glob<T = unknown>(pattern: string | string[], options?: { eager?: boolean; import?: string; query?: string }): Record<string, T>;
  readonly env: { readonly DEV: boolean; readonly PROD: boolean; readonly BASE_URL: string };
}
