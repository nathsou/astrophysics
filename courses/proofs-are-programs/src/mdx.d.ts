declare module '*.mdx' {
  import type { Component } from 'solid-js';
  const MDXComponent: Component<{ components?: Record<string, unknown> }>;
  export default MDXComponent;
}
