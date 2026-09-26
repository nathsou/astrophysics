import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'http://localhost:4321',
  integrations: [mdx()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      // trust:true enables \htmlData{term=...}{...} used for hover-linked equation terms
      rehypePlugins: [[rehypeKatex, { trust: true, strict: false }]],
    }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-dimmed' } },
  },
  vite: { build: { target: 'es2022' } },
});
