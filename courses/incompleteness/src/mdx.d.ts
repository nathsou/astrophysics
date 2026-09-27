declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const C: ComponentType<Record<string, unknown>>;
  export default C;
}
