import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { rehypeRawKatex, remarkCodeBlocks } from './build/mdx-plugins.ts';

export default defineConfig({
  base: './',
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
