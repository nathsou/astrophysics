import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://nathsou.github.io',
  base: '/astrophysics',
  integrations: [mdx()],
  devToolbar: { enabled: false },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      // trust:true enables \htmlData{term=...}{...} used for hover-linked equation terms
      rehypePlugins: [[rehypeKatex, {
        trust: true,
        strict: false,
        // \term{id}{tex} marks a hoverable equation term; its explanation comes from
        // src/lib/terms.ts (global) or the chapter's <Terms> block (see CONTRIBUTING.md).
        macros: { '\\term': '\\htmlData{term=#1}{#2}' },
      }]],
    }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-dimmed' } },
  },
  vite: { build: { target: 'es2022' } },
});
