/**
 * Every piece of Chinese the course can speak, keyed exactly as the player looks clips up
 * (src/lib/audio/speech.svelte.ts: clipKey). Text generated on the fly (number drills, the town
 * map's questions) is left to the browser's voice.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
import type { Code, Text } from 'mdast';
import { annotate, plain } from '$lib/zh/annotate';
import { allWords } from '$lib/zh/lexicon';
import { EXERCISE_KINDS } from '$lib/exercises/kinds';

export type Tier = 'words' | 'lessons' | 'extras';

/** The key a clip is stored under: readings stripped, whitespace removed. */
export const clipKey = (text: string) => plain(text).replace(/\s+/g, '').trim();

const HAN = /\p{Script=Han}/u;
const RUN = /\p{Script=Han}(?:\[[^\]\s]+\])?(?:[\p{Script=Han}，。！？、：；“”‘’（）《》…—～·](?:\[[^\]\s]+\])?)*/gu;

export function collect(root: string): Map<string, Tier> {
  const out = new Map<string, Tier>();
  const add = (text: string, tier: Tier) => {
    const k = clipKey(text);
    if (!k || !HAN.test(k) || k.length > 400) return;
    // Lower tiers win: a word needed by a lesson is a "words" clip.
    const order: Tier[] = ['words', 'lessons', 'extras'];
    const prev = out.get(k);
    if (!prev || order.indexOf(tier) < order.indexOf(prev)) out.set(k, tier);
  };
  /** A string as the components use it: whole, as annotated runs, and as words. */
  const addText = (text: string, tier: Tier) => {
    if (!HAN.test(text)) return;
    // Whole strings are only spoken when they are pure Chinese (not English with Chinese inside).
    if (!/[A-Za-z]/.test(plain(text)) && !text.includes('___')) add(text, tier);
    for (const m of text.matchAll(RUN)) {
      add(m[0], tier);
      for (const t of annotate(m[0])) if (t.s) add(t.t, tier === 'lessons' ? 'lessons' : tier);
    }
  };
  const walk = (v: unknown, tier: Tier) => {
    if (typeof v === 'string') addText(v, tier);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, tier));
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, tier));
  };

  // 1. Every HSK 1–2 word in any list, and the course's own additions: word cards and reviews.
  for (const w of allWords()) {
    const levels = Object.values(w.l);
    if (!levels.length || levels.some((l) => l !== undefined && l <= 2)) add(w.w, 'words');
  }

  // 2. Lessons: prose, dialogues, word lists and every exercise string.
  const lessons = join(root, 'content/lessons');
  for (const f of readdirSync(lessons).filter((x) => x.endsWith('.md'))) {
    const src = readFileSync(join(lessons, f), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
    const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(src);
    visit(tree, (node) => {
      if (node.type === 'text') addText((node as Text).value, 'lessons');
      if (node.type !== 'code') return;
      const c = node as Code;
      if (c.lang === 'words') for (const l of c.value.split('\n')) addText(l.split('|')[0]!.trim(), 'words');
      else if (c.lang === 'dialogue')
        for (const l of c.value.split('\n')) {
          const m = /^[^:：]+[:：]\s*(.+)$/.exec(l.trim());
          if (m && !l.trim().startsWith('title:')) addText(m[1]!.split('|')[0]!.trim(), 'lessons');
        }
      else if (c.lang && EXERCISE_KINDS.includes(c.lang)) {
        const data = YAML.parse(c.value);
        walk(data, 'lessons');
        // Sentence builders speak the assembled sentence.
        if (c.lang === 'order') for (const it of data.items ?? []) add(String(it.zh).replace(/\s+/g, ''), 'lessons');
        if (c.lang === 'write') for (const ch of String(data.chars)) add(ch, 'lessons');
      }
    });
  }

  // 3. Course data and app source: widgets, exams, placement, the practice games.
  const sources = [join(root, 'content/data'), join(root, 'content/exams'), join(root, 'src')];
  for (const dir of sources) {
    for (const f of readdirSync(dir, { recursive: true }) as string[]) {
      if (!/\.(ts|svelte)$/.test(f) || f.endsWith('.test.ts')) continue;
      const text = readFileSync(join(dir, f), 'utf8');
      for (const m of text.matchAll(/'([^'\n]*\p{Script=Han}[^'\n]*)'|"([^"\n]*\p{Script=Han}[^"\n]*)"/gu)) {
        const s = (m[1] ?? m[2]!).replace(/[男女]：/g, '');
        addText(s, 'extras');
        for (const part of s.split(/[,，]/)) if (part.length <= 4) addText(part, 'extras');
      }
    }
  }
  return out;
}
