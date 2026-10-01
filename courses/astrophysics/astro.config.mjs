import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import { remarkCourseLinks } from './build/remark-course-links.mjs';
import rehypeKatex from 'rehype-katex';
import { almanacLight, almanacDark } from './src/styles/shiki-almanac.mjs';

export default defineConfig({
  site: 'https://nathsou.github.io',
  base: `${process.env.COURSES_BASE_PATH ?? ''}/astrophysics`,
  integrations: [mdx()],
  devToolbar: { enabled: false },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, [remarkCourseLinks, { base: `${process.env.COURSES_BASE_PATH ?? ''}/astrophysics` }]],
      // trust:true enables \htmlData{term=...}{...} used for hover-linked equation terms
      rehypePlugins: [[rehypeKatex, {
        trust: true,
        strict: false,
        // \term{id}{tex} marks a hoverable equation term; its explanation comes from
        // src/lib/terms.ts (global) or the chapter's <Terms> block (see CONTRIBUTING.md).
        macros: { '\\term': '\\htmlData{term=#1}{#2}' },
      }]],
    }),
    // Custom themes tinted to the Almanac palette (src/styles/shiki-almanac.mjs); global.css picks the dark one.
    shikiConfig: { themes: { light: almanacLight, dark: almanacDark } },
  },
  vite: { build: { target: 'es2022' } },
});
