import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { rehypeRawKatex, remarkCodeBlocks } from './build/mdx-plugins.ts';

// The kernel is shared with the Proofs Are Programs course (packages/kernel).
const kernel = fileURLToPath(new URL('../../packages/kernel/src', import.meta.url));

export default defineConfig({
  base: './',
  resolve: { alias: { '@kernel': kernel } },
  server: { fs: { allow: ['.', kernel, fileURLToPath(new URL('../../packages/course-navigation', import.meta.url))] } },
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        jsx: true,
        jsxImportSource: 'solid-js',
        remarkPlugins: [remarkGfm, remarkMath, remarkCodeBlocks],
        rehypePlugins: [[rehypeKatex, { strict: false, trust: true }], rehypeRawKatex],
      }),
    },
    solid({ extensions: ['.mdx'] }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  worker: { format: 'es' },
});
