// Turns "Chapter 14", "Chapters 12–14", "Chapters 15 and 19" and "Appendix E" in chapter prose into links.
// Chapter numbers come from src/content/course.ts, so renumbering chapters keeps the links right.

import { readFileSync } from 'node:fs';
import { findAndReplace } from 'mdast-util-find-and-replace';
import type { PhrasingContent, Root } from 'mdast';

const course = readFileSync(new URL('../src/content/course.ts', import.meta.url), 'utf8');
const SLUG_BY_NUM = new Map([...course.matchAll(/slug: '([^']+)', num: '([^']+)'/g)].map((m) => [m[2], m[1]]));

const REF = /\b(Chapters?|[Aa]ppendix|[Aa]ppendices)\s+((?:\d+|[A-H])\b(?:(?:\s*[–,]\s*|\s+and\s+)(?:\d+|[A-H])\b)*)/g;

export default function remarkXref() {
  return (tree: Root) => {
    findAndReplace(
      tree,
      [REF, (match: string, word: string, list: string) => {
        const only = SLUG_BY_NUM.get(list);
        if (only) return { type: 'link', url: `#/ch/${only}`, children: [{ type: 'text', value: match }] };
        const out: PhrasingContent[] = [{ type: 'text', value: `${word} ` }];
        for (const part of list.split(/(\s*[–,]\s*|\s+and\s+)/)) {
          const slug = SLUG_BY_NUM.get(part);
          if (slug) out.push({ type: 'link', url: `#/ch/${slug}`, children: [{ type: 'text', value: part }] });
          else out.push({ type: 'text', value: part });
        }
        return out;
      }],
      { ignore: ['link', 'linkReference', 'heading', 'inlineCode', 'code'] },
    );
  };
}
