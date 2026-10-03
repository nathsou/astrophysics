/**
 * Lesson Markdown → Svelte component.
 *
 * Lessons are Markdown (GFM) with front matter, plus:
 *
 *   Chinese in running text      any run of Chinese characters becomes a <Zh> word group with
 *                                pinyin, tone colours, audio and a tap-to-define popover.
 *                                Force a reading with 字[pinyin]: 长[zhǎng]大.
 *   :::note / :::tip / :::culture / :::grammar[Title] / :::mistake / :::key / :::fun
 *                                callouts (the [label] is an optional title)
 *   :::details[Summary]          a collapsible aside
 *   ::widget-name{prop=…}        an interactive widget from $lib/widgets (WidgetName.svelte)
 *   ```words                     a word list: one word per line, optional "| gloss"
 *   ```dialogue                  a dialogue: "Speaker: 中文 | English" per line
 *   ```choose / tones / pinyin / order / match / fill / sort / scene / story / write /
 *      speak / roleplay / compose
 *                                exercises, as YAML (see src/lib/exercises/types.ts)
 *
 * `## Headings` divide a lesson into sessions; each gets an id and a table-of-contents entry.
 * The module script exports `metadata` (front matter + the words taught) and `toc`.
 */
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import YAML from 'yaml';
import type { Root, Parent, Code, Heading, Text, RootContent } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { EXERCISE_KINDS } from '../../src/lib/exercises/kinds.ts';

const CALLOUTS = new Set(['note', 'tip', 'culture', 'grammar', 'mistake', 'key', 'fun']);

/** Chinese runs: Han characters (each optionally followed by a [reading]) and CJK punctuation. */
const HAN_RUN = /\p{Script=Han}(?:\[[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+\])?(?:[\p{Script=Han}，。！？、：；“”‘’（）《》…—～·](?:\[[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+\])?)*/gu;

export class LessonError extends Error {}

interface Ctx {
  file: string;
  slug: string;
  data: unknown[];
  parts: string[];
  imports: Map<string, string>;
  exercises: number;
  words: string[];
  toc: { id: string; text: string }[];
  ids: Set<string>;
}

function html(value: string): RootContent {
  return { type: 'html', value } as RootContent;
}

/** Register a JSON value for the component script; returns its expression. */
function datum(ctx: Ctx, value: unknown): string {
  ctx.data.push(value);
  return `D[${ctx.data.length - 1}]`;
}

/** Register a piece of Svelte markup; returns a placeholder that survives HTML rendering. */
function part(ctx: Ctx, markup: string): string {
  ctx.parts.push(markup);
  return `@@P${ctx.parts.length - 1}@@`;
}

function use(ctx: Ctx, name: string, from: string): string {
  ctx.imports.set(name, from);
  return name;
}

const pascal = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\p{Script=Han}|\[[^\]]*\]/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

function parseValue(v: string | null | undefined): unknown {
  if (v === null || v === undefined || v === '') return true;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  if (/^[[{]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      /* plain string */
    }
  }
  return v;
}

function zhMarkup(ctx: Ctx, text: string): string {
  return part(ctx, `<${use(ctx, 'Zh', '$lib/components/zh/Zh.svelte')} text={${datum(ctx, text)}} />`);
}

/** Replace Chinese runs inside text nodes with <Zh> placeholders. */
function annotateText(tree: Root, ctx: Ctx): void {
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index === undefined) return;
    if (parent.type === 'link' || parent.type === 'heading') return;
    const value = node.value;
    HAN_RUN.lastIndex = 0;
    if (!HAN_RUN.test(value)) return;
    HAN_RUN.lastIndex = 0;
    const out: RootContent[] = [];
    let last = 0;
    for (const m of value.matchAll(HAN_RUN)) {
      if (m.index! > last) out.push({ type: 'text', value: value.slice(last, m.index) } as RootContent);
      out.push(html(zhMarkup(ctx, m[0])));
      last = m.index! + m[0].length;
    }
    if (last < value.length) out.push({ type: 'text', value: value.slice(last) } as RootContent);
    parent.children.splice(index, 1, ...(out as typeof parent.children));
    return [SKIP, index + out.length];
  });
}

function wordsBlock(code: Code, ctx: Ctx): string {
  const items = code.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [w, g] = l.split('|').map((s) => s.trim());
      return g ? { w: w!, g } : { w: w! };
    });
  for (const it of items) ctx.words.push(it.w.replace(/\[[^\]]*\]/g, ''));
  return part(ctx, `<${use(ctx, 'WordList', '$lib/components/zh/WordList.svelte')} items={${datum(ctx, items)}} />`);
}

function dialogueBlock(code: Code, ctx: Ctx): string {
  let title: string | undefined;
  const lines: { who: string; zh: string; en?: string }[] = [];
  for (const raw of code.value.split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    const t = /^title:\s*(.+)$/.exec(l);
    if (t) {
      title = t[1];
      continue;
    }
    const m = /^([^:：]+)[:：]\s*(.+)$/.exec(l);
    if (!m) throw new LessonError(`${ctx.file}: dialogue line without a speaker: "${l}"`);
    const [zh, en] = m[2]!.split('|').map((s) => s.trim());
    lines.push({ who: m[1]!.trim(), zh: zh!, ...(en ? { en } : {}) });
  }
  return part(ctx, `<${use(ctx, 'Dialogue', '$lib/components/zh/Dialogue.svelte')} title={${datum(ctx, title ?? null)}} lines={${datum(ctx, lines)}} />`);
}

function exerciseBlock(code: Code, ctx: Ctx): string {
  let data: unknown;
  try {
    data = YAML.parse(code.value);
  } catch (e) {
    throw new LessonError(`${ctx.file}:${code.position?.start.line}: invalid YAML in ${code.lang} exercise: ${(e as Error).message}`);
  }
  if (!data || typeof data !== 'object') throw new LessonError(`${ctx.file}:${code.position?.start.line}: empty ${code.lang} exercise`);
  const id = `${ctx.slug}/${++ctx.exercises}`;
  const Exercise = use(ctx, 'Exercise', '$lib/components/exercise/Exercise.svelte');
  return part(ctx, `<${Exercise} kind="${code.lang}" id="${id}" data={${datum(ctx, data)}} />`);
}

function transform(tree: Root, ctx: Ctx): void {
  // Prose list spacing must not affect the lists rendered inside widgets or word cards.
  visit(tree, (node) => {
    if (node.type === 'list' || node.type === 'listItem') {
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, className: ['prose-list'] } };
    }
  });
  // Fenced blocks first (they contain Chinese that must not be annotated as prose).
  visit(tree, 'code', (node: Code, index, parent: Parent | undefined) => {
    if (!parent || index === undefined) return;
    let placeholder: string | undefined;
    if (node.lang === 'words') placeholder = wordsBlock(node, ctx);
    else if (node.lang === 'dialogue') placeholder = dialogueBlock(node, ctx);
    else if (node.lang && EXERCISE_KINDS.includes(node.lang)) placeholder = exerciseBlock(node, ctx);
    if (placeholder) parent.children.splice(index, 1, html(placeholder) as never);
  });

  // Headings: ids and the table of contents.
  visit(tree, 'heading', (node: Heading) => {
    const text = toString(node).replace(/\[[^\]]*\]/g, '');
    if (node.depth !== 2) return;
    let id = slugify(text);
    for (let n = 2; ctx.ids.has(id); n++) id = `${slugify(text)}-${n}`;
    ctx.ids.add(id);
    ctx.toc.push({ id, text });
    node.data = { ...node.data, hProperties: { id } };
  });

  annotateText(tree, ctx);

  visit(tree, (node, index, parent: Parent | undefined) => {
    if (!parent || index === undefined) return;
    if (node.type === 'containerDirective') {
      const d = node as ContainerDirective;
      const labelNode = d.children[0] as Parent & { data?: { directiveLabel?: boolean } };
      const hasLabel = labelNode?.data?.directiveLabel;
      const label = hasLabel ? toString(labelNode) : undefined;
      const body = hasLabel ? d.children.slice(1) : d.children;
      let open: string;
      let close: string;
      if (CALLOUTS.has(d.name)) {
        const C = use(ctx, 'Callout', '$lib/components/content/Callout.svelte');
        open = `<${C} kind="${d.name}" title={${datum(ctx, label ?? null)}}>`;
        close = `</${C}>`;
      } else if (d.name === 'details') {
        const C = use(ctx, 'Details', '$lib/components/content/Details.svelte');
        open = `<${C} summary={${datum(ctx, label ?? 'More')}}>`;
        close = `</${C}>`;
      } else {
        throw new LessonError(`${ctx.file}: unknown container :::${d.name}`);
      }
      parent.children.splice(index, 1, html(part(ctx, open)) as never, ...(body as never[]), html(part(ctx, close)) as never);
      return index + body.length + 2;
    }
    if (node.type === 'leafDirective') {
      const d = node as LeafDirective;
      const props = Object.entries(d.attributes ?? {})
        .map(([k, v]) => `${k}={${datum(ctx, parseValue(v))}}`)
        .join(' ');
      const name = pascal(d.name);
      const C = use(ctx, name, `$lib/widgets/${name}.svelte`);
      parent.children.splice(index, 1, html(part(ctx, `<${C} ${props} />`)) as never);
      return index + 1;
    }
    if (node.type === 'textDirective') {
      const d = node as TextDirective;
      if (d.name === 'zh') {
        parent.children.splice(index, 1, html(zhMarkup(ctx, toString(d))) as never);
        return index + 1;
      }
      // Not a directive after all (e.g. "10:30"): put the text back.
      parent.children.splice(index, 1, { type: 'text', value: `:${d.name}${toString(d) ? `[${toString(d)}]` : ''}` } as never);
      return index + 1;
    }
  });
}

export interface LessonFront {
  title: string;
  zh?: string;
  summary?: string;
  minutes?: number;
  /** Extra words taught in the lesson but not shown in a ```words block. */
  words?: string[];
  goals?: string[];
}

export function compileLesson(source: string, file: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(source);
  const front = (fm ? YAML.parse(fm[1]!) : {}) as LessonFront;
  if (!front?.title) throw new LessonError(`${file}: front matter needs a title`);
  const body = fm ? source.slice(fm[0].length) : source;
  const slug = path.basename(file, '.md');
  const ctx: Ctx = { file, slug, data: [], parts: [], imports: new Map(), exercises: 0, words: [], toc: [], ids: new Set() };

  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
  const tree = processor.parse(body) as Root;
  transform(tree, ctx);
  const hast = unified().use(remarkRehype, { allowDangerousHtml: true }).runSync(tree);
  let out = unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(hast as never);
  // Braces are Svelte syntax; everything except our placeholders is literal HTML.
  out = out.replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
  out = out.replace(/<p>(@@P\d+@@)<\/p>/g, '$1');
  out = out.replace(/@@P(\d+)@@/g, (_, n: string) => ctx.parts[Number(n)]!);

  const words = [...new Set([...ctx.words, ...(front.words ?? [])])];
  const metadata = { ...front, slug, words, exercises: ctx.exercises };
  const imports = [...ctx.imports].map(([name, from]) => `  import ${name} from '${from}';`).join('\n');
  return `<script module>
  export const metadata = ${JSON.stringify(metadata)};
  export const toc = ${JSON.stringify(ctx.toc)};
</script>

<script>
${imports}
  const D = ${JSON.stringify(ctx.data)};
</script>

<div class="prose">
${out}
</div>
`;
}

/** Collect every Chinese string in a lesson (for audio generation and content checks). */
export function lessonStrings(source: string): string[] {
  const out: string[] = [];
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(body) as Root;
  visit(tree, (node) => {
    if (node.type === 'code') {
      const c = node as Code;
      for (const m of c.value.matchAll(HAN_RUN)) out.push(m[0]);
    } else if (node.type === 'text') {
      for (const m of (node as Text).value.matchAll(HAN_RUN)) out.push(m[0]);
    }
  });
  return out;
}
