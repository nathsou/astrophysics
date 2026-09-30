/**
 * Markdown → Svelte compiler for course content.
 *
 * Chapters are plain Markdown (GFM + $maths$) extended with directives:
 *
 *   :::note / :::tip / :::warning / :::lab / :::breakit / :::challenge / :::exercises
 *   :::history{year=1948 title="…"}          archive card
 *   :::equation{#zipf caption="…"}           numbered display equation (with a ```terms block)
 *   :::details[Summary text]                 collapsible
 *   :::figure{caption="…" wide}              figure wrapper
 *   ::some-widget{prop=1 other="x"}          any Svelte widget (./widgets/SomeWidget.svelte or $lib/widgets)
 *   :sidenote[margin note]  :cite[key1,key2]  :term[glossary word]{id=…}
 *
 * Mathematics:
 *   :::theorem{name="Euclid IX.20" who="Euclid" year="c. 300 BC"}   (also lemma, corollary,
 *                                            proposition, conjecture, claim) — numbered per chapter
 *   :::proof[Proof (Euler, 1737)]            proof with a tombstone
 *   :::bio{name="Carl Friedrich Gauss" born=1777 died=1855}          biography card
 *   ::::zoom + :::level[Idea]                a proof at several levels of detail
 *   ::::hints + :::hint[…]                   a hint ladder, revealed one rung at a time
 *
 * Fenced blocks with language `terms` define hover docs for \term{id}{…} symbols; `quiz`
 * blocks become multiple-choice questions. Exercises are YAML blocks too: `step` (a chain of
 * claims checked by the CAS), `blanks` (fill in a proof), `parsons` (put the lines of a proof in
 * order), `bug` (find the faulty line) and `prove` (write a proof; model answer and rubric).
 *
 * Output is a Svelte component whose `<script module>` exports metadata, toc, terms,
 * references and glossary, so routes can render chrome around the content.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import YAML from 'yaml';
import type { Root, Nodes, Parent, Html, Code, Heading, Image, Link } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { highlight, renderMath, termRefs } from './render.ts';

type Directive = ContainerDirective | LeafDirective | TextDirective;

interface ComponentUse {
  tag: string;
  props: string;
}

interface RawTerm {
  label?: string;
  what?: string;
  why?: string;
  effect?: string;
  param?: { key: string; min: number; max: number; step: number; value: number; log?: boolean };
}

interface Ctx {
  file: string;
  dir: string;
  contentRoot: string;
  components: ComponentUse[];
  imports: string[];
  importCount: number;
  terms: Record<string, RawTerm>;
  termRefs: Set<string>;
  toc: { id: string; text: string; depth: 2 | 3 }[];
  slugs: Map<string, number>;
  cites: Set<string>;
  glossaryRefs: Set<string>;
  equations: number;
  theorems: number;
  exercises: number;
  chapterNumber: string;
  slug: string;
  deps: Set<string>;
  asyncJobs: Promise<void>[];
}

const CALLOUTS = new Set(['note', 'tip', 'warning', 'info', 'lab', 'breakit', 'challenge', 'exercises', 'definition', 'key', 'question', 'aside', 'programmer', 'hood', 'deeper', 'real']);
const TEXT_DIRECTIVES = new Set(['sidenote', 'cite', 'term', 'kbd']);
const BUILTIN_BLOCKS: Record<string, string> = {
  history: 'History',
  equation: 'Equation',
  details: 'Details',
  figure: 'Figure',
  columns: 'Columns',
  proof: 'Proof',
  bio: 'Bio',
  zoom: 'Zoom',
  level: 'ZoomLevel',
  hints: 'Hints',
  hint: 'Hint',
};
const THEOREM_KINDS = new Set(['theorem', 'lemma', 'corollary', 'proposition', 'conjecture', 'claim']);
const EXERCISE_BLOCKS: Record<string, string> = { parsons: 'Parsons', bug: 'SpotBug', build: 'Build', debug: 'Debug', measure: 'Measure', golf: 'Golf', asm: 'Asm' };
/**
 * Fields of the circuit and program exercises that are data, not Markdown: circuits, specifications, tests,
 * source code. They are passed through untouched. Circuits may be written as a path relative to
 * content/chapters/ (`circuits/x.json` files, as for `::circuit src`), which is read and inlined here.
 */
const RAW_FIELDS: Record<string, string[]> = {
  build: ['spec', 'start', 'solution', 'budget', 'allowed', 'part'],
  debug: ['spec', 'start', 'solution', 'budget', 'allowed', 'part'],
  golf: ['spec', 'start', 'solution', 'budget', 'allowed', 'part'],
  measure: ['circuit', 'src', 'probe', 'tolerance', 'answer'],
  asm: ['start', 'solution', 'tests'],
};
/** Raw fields that hold a circuit (or, under `spec`, a `reference`) and may be a JSON file path. */
const CIRCUIT_FIELDS = new Set(['start', 'solution', 'circuit']);
/** YAML fields of exercise blocks that hold Markdown (rendered at build time). */
const MARKDOWN_FIELDS = new Set(['prompt', 'question', 'text', 'solution', 'why', 'explain', 'hint', 'hints', 'lines', 'distractors', 'rubric', 'feedback', 'note', 'success', 'options', 'label']);

const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());
const camel = (s: string) => s.replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());

/** Serialise directive attributes as Svelte props. Numbers, booleans and JSON literals stay typed. */
function props(attrs: Record<string, string | null | undefined> | null | undefined, extra: Record<string, unknown> = {}): string {
  const out: string[] = [];
  for (const [k, raw] of Object.entries(attrs ?? {})) {
    const key = k === 'class' ? 'class' : camel(k);
    if (raw == null || raw === '') {
      out.push(`${key}={true}`);
      continue;
    }
    let expr = JSON.stringify(raw);
    if (/^(-?\d+(\.\d+)?(e-?\d+)?|true|false)$/.test(raw) || /^[[{]/.test(raw)) {
      try {
        expr = JSON.stringify(JSON.parse(raw));
      } catch {
        /* keep as string */
      }
    }
    out.push(`${key}={${expr}}`);
  }
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) out.push(`${k}={${JSON.stringify(v)}}`);
  return out.join(' ');
}

function marker(kind: 'open' | 'close' | 'leaf', i: number): Html {
  return { type: 'html', value: `<!--§${kind}:${i}-->` };
}

function slugify(ctx: Ctx, text: string): string {
  const base =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';
  const n = ctx.slugs.get(base) ?? 0;
  ctx.slugs.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

function addImport(ctx: Ctx, spec: string, prefix: string): string {
  const name = `__${prefix}${ctx.importCount++}`;
  ctx.imports.push(`import ${name} from ${JSON.stringify(spec)};`);
  return name;
}

const widgetIndex = (ctx: Ctx) => path.join(ctx.contentRoot, '..', 'src/lib/widgets/index.ts');

/** Resolve a directive name to a component tag, adding imports as needed. */
function resolveComponent(ctx: Ctx, name: string): string {
  const Name = pascal(name);
  const local = path.join(ctx.dir, 'widgets', `${Name}.svelte`);
  if (existsSync(local)) {
    const existing = ctx.imports.find((l) => l.startsWith(`import ${Name} `));
    if (!existing) ctx.imports.push(`import ${Name} from './widgets/${Name}.svelte';`);
    return Name;
  }
  const index = widgetIndex(ctx);
  ctx.deps.add(index);
  const src = existsSync(index) ? readFileSync(index, 'utf8') : '';
  if (new RegExp(`\\b(as|default as)\\s+${Name}\\b|export \\{[^}]*\\b${Name}\\b`).test(src)) return `W.${Name}`;
  throw new Error(`${ctx.file}: unknown directive/widget "${name}" — expected ./widgets/${Name}.svelte or an export named ${Name} in src/lib/widgets/index.ts`);
}

const inlineProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/** Render a short Markdown string (term docs, quiz text) to HTML. Maths is supported. */
async function renderInline(md: string | undefined): Promise<string | undefined> {
  if (md == null) return undefined;
  const tree = inlineProcessor.parse(String(md)) as Root;
  visit(tree, (node, index, parent) => {
    if ((node.type === 'inlineMath' || node.type === 'math') && parent && index !== undefined) {
      parent.children[index] = { type: 'html', value: renderMath(node.value, node.type === 'math') } as never;
    }
  });
  const hast = await unified().use(remarkRehype, { allowDangerousHtml: true }).run(tree);
  let html = unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(hast as never);
  const single = /^<p>([\s\S]*)<\/p>$/.exec(html.trim());
  if (single && !single[1]!.includes('<p>')) html = single[1]!;
  return html;
}

/** Render the Markdown fields of an exercise spec (recursively through arrays and objects). */
async function renderFields(data: Record<string, unknown>, inMarkdown = false, raw: string[] = []): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = raw.includes(k) ? v : await renderValue(v, inMarkdown || MARKDOWN_FIELDS.has(k));
  return out;
}

/** Replace circuit file paths in an exercise block by the circuits themselves. */
function inlineCircuits(ctx: Ctx, kind: string, data: Record<string, unknown>): void {
  const load = (ref: string, field: string): unknown => {
    const file = path.join(ctx.contentRoot, 'chapters', ref);
    if (!existsSync(file)) throw new Error(`${path.relative(ctx.contentRoot, ctx.file)}: the \`${field}\` of a \`\`\`${kind} block names ${ref}, which does not exist under content/chapters/`);
    ctx.deps.add(file);
    return JSON.parse(readFileSync(file, 'utf8'));
  };
  const isPath = (v: unknown): v is string => typeof v === 'string' && /\.json$/.test(v);
  for (const f of CIRCUIT_FIELDS) if (isPath(data[f])) data[f] = load(data[f] as string, f);
  const spec = data.spec as Record<string, unknown> | undefined;
  if (spec && isPath(spec.reference)) spec.reference = load(spec.reference, 'spec.reference');
  // A measure block may name its circuit with `src`, as ::circuit does; the answer's probe needs the circuit itself.
  if (kind === 'measure' && isPath(data.src) && data.circuit === undefined) {
    data.circuit = load(data.src, 'src');
    delete data.src;
  }
}

async function renderValue(v: unknown, md: boolean): Promise<unknown> {
  // In a Markdown list, "- Divide by $a - b$: …" is a YAML mapping; authors mean the text.
  if (md && v && typeof v === 'object' && !Array.isArray(v)) {
    const entries = Object.entries(v);
    if (entries.length === 1 && (typeof entries[0]![1] === 'string' || typeof entries[0]![1] === 'number')) v = `${entries[0]![0]}: ${entries[0]![1]}`;
  }
  if (typeof v === 'number' && md) v = String(v);
  if (typeof v === 'string') return md ? await renderInline(v) : v;
  if (Array.isArray(v)) return Promise.all(v.map((x) => renderValue(x, md)));
  if (v && typeof v === 'object') return renderFields(v as Record<string, unknown>, md);
  return v;
}

/** Parse a fenced YAML block with an error message that points at the chapter and the usual culprit. */
function parseYamlBlock<T>(ctx: Ctx, src: string, kind: string): T {
  // Prose fields often contain “: ” (which YAML reads as a nested mapping). Turn an unquoted
  // single-line prose value that contains one into a block scalar.
  src = src.replace(
    /^(\s*)(why|prompt|solution|explain|hint|text|title|note|q|success|feedback|tutor):[ \t]+(?![|>'"])(.*: .*)$/gm,
    (_, indent: string, key: string, value: string) => `${indent}${key}: |\n${indent}  ${value}`,
  );
  try {
    return YAML.parse(src) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${path.relative(ctx.contentRoot, ctx.file)}: invalid YAML in a \`\`\`${kind} block — ${msg}\n` +
        `Hint: quote values that contain ": " or start with a special character; use single quotes when the value contains backslashes (LaTeX).`,
    );
  }
}

function loadYaml<T>(file: string, ctx: Ctx): T {
  ctx.deps.add(file);
  return existsSync(file) ? ((YAML.parse(readFileSync(file, 'utf8')) ?? {}) as T) : ({} as T);
}

async function buildReferenceList(ctx: Ctx, name: string, i: number): Promise<void> {
  if (name === 'all-references') {
    const bib = loadYaml<Record<string, { authors: string; year: number | string } & Record<string, unknown>>>(path.join(ctx.contentRoot, 'bibliography.yaml'), ctx);
    const items = Object.entries(bib)
      .map(([key, r]) => ({ key, ...r }))
      .sort((a, b) => String(a.authors).localeCompare(String(b.authors)) || Number(a.year) - Number(b.year));
    ctx.components[i] = { tag: 'B.ReferenceList', props: `items={${JSON.stringify(items)}}` };
  } else if (name === 'all-glossary') {
    const g = loadYaml<Record<string, { term: string; definition: string; chapter?: string }>>(path.join(ctx.contentRoot, 'glossary.yaml'), ctx);
    const items = await Promise.all(
      Object.entries(g).map(async ([id, e]) => ({ id, term: e.term, chapter: e.chapter, definition: await renderInline(e.definition) })),
    );
    items.sort((a, b) => a.term.localeCompare(b.term));
    ctx.components[i] = { tag: 'B.GlossaryList', props: `items={${JSON.stringify(items)}}` };
  } else {
    const t = loadYaml<{ year: number; title: string; people?: string; chapter?: string; text: string }[]>(path.join(ctx.contentRoot, 'timeline.yaml'), ctx);
    const items = await Promise.all((Array.isArray(t) ? t : []).map(async (e) => ({ ...e, text: await renderInline(e.text) })));
    items.sort((a, b) => a.year - b.year);
    ctx.components[i] = { tag: 'B.Timeline', props: `items={${JSON.stringify(items)}}` };
  }
}

function transformDirective(ctx: Ctx, node: Directive, parent: Parent, index: number): number | void {
  const name = node.name;
  const attrs = { ...(node.attributes ?? {}) };

  // Unknown text directives are almost always prose like "ratio 3:1" — put the text back.
  if (node.type === 'textDirective' && !TEXT_DIRECTIVES.has(name)) {
    const label = node.children.length ? `[${toString(node)}]` : '';
    parent.children.splice(index, 1, { type: 'text', value: `:${name}${label}` } as never);
    return index + 1;
  }

  // Container label ([…] right after the name) becomes the title.
  let title: string | undefined;
  if (node.type === 'containerDirective') {
    const first = node.children[0];
    if (first && first.type === 'paragraph' && (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) {
      title = toString(first);
      node.children.shift();
    }
  } else if (node.type === 'leafDirective' && node.children.length) {
    title = toString(node);
    node.children = [];
  }

  let tag: string;
  const extra: Record<string, unknown> = {};
  if (title !== undefined && attrs.title == null) extra.title = title;

  if (node.type === 'textDirective') {
    if (name === 'cite') {
      const keys = toString(node).split(',').map((k) => k.trim()).filter(Boolean);
      keys.forEach((k) => ctx.cites.add(k));
      ctx.components.push({ tag: 'B.Cite', props: props(attrs, { keys }) });
      parent.children.splice(index, 1, marker('leaf', ctx.components.length - 1));
      return index + 1;
    }
    if (name === 'term') {
      const id = attrs.id ?? toString(node).toLowerCase();
      delete attrs.id;
      ctx.glossaryRefs.add(id);
      extra.id = id;
      tag = 'B.GlossaryTerm';
    } else if (name === 'kbd') {
      tag = 'B.Kbd';
    } else {
      tag = 'B.Sidenote';
    }
  } else if (name === 'all-references' || name === 'all-glossary' || name === 'timeline') {
    // Whole-course reference lists, embedded at build time (Appendix J).
    const i = ctx.components.push({ tag: '', props: '' }) - 1;
    ctx.asyncJobs.push(buildReferenceList(ctx, name, i));
    parent.children.splice(index, 1, marker('leaf', i));
    return index + 1;
  } else if (THEOREM_KINDS.has(name)) {
    tag = 'B.Theorem';
    extra.kind = name;
    if (name !== 'conjecture') extra.n = `${ctx.chapterNumber ? `${ctx.chapterNumber}.` : ''}${++ctx.theorems}`;
  } else if (CALLOUTS.has(name)) {
    tag = 'B.Callout';
    extra.kind = name;
  } else if (BUILTIN_BLOCKS[name]) {
    tag = `B.${BUILTIN_BLOCKS[name]}`;
    if (name === 'equation') extra.n = ++ctx.equations;
  } else {
    tag = resolveComponent(ctx, name);
  }

  ctx.components.push({ tag, props: props(attrs, extra) });
  const i = ctx.components.length - 1;
  if (node.type === 'leafDirective') {
    parent.children.splice(index, 1, marker('leaf', i));
    return index + 1;
  }
  parent.children.splice(index, 1, marker('open', i), ...(node.children as never[]), marker('close', i));
  return index + 1;
}

async function transform(tree: Root, ctx: Ctx): Promise<void> {
  visit(tree, (node: Nodes, index, parent) => {
    if (index === undefined || !parent) return;
    switch (node.type) {
      case 'containerDirective':
      case 'leafDirective':
      case 'textDirective':
        return transformDirective(ctx, node, parent, index);

      case 'heading': {
        const h = node as Heading;
        const text = toString(h);
        const id = slugify(ctx, text);
        h.data = { ...h.data, hProperties: { id } };
        if (h.depth === 2 || h.depth === 3) ctx.toc.push({ id, text, depth: h.depth });
        return;
      }

      case 'math':
      case 'inlineMath': {
        termRefs(node.value).forEach((t) => ctx.termRefs.add(t));
        const html = renderMath(node.value, node.type === 'math');
        parent.children[index] = {
          type: 'html',
          value: node.type === 'math' ? `<div class="math-display">${html}</div>` : html,
        } as never;
        return;
      }

      case 'code': {
        const code = node as Code;
        if (code.lang === 'terms') {
          Object.assign(ctx.terms, parseYamlBlock<Record<string, RawTerm>>(ctx, code.value, 'terms'));
          parent.children.splice(index, 1);
          return index;
        }
        if (code.lang === 'quiz') {
          const data = parseYamlBlock<{ q: string; options: { text: string; correct?: boolean; why?: string }[] }>(ctx, code.value, 'quiz');
          const i = ctx.components.push({ tag: 'B.Quiz', props: '' }) - 1;
          ctx.asyncJobs.push(
            (async () => {
              const rendered = {
                question: await renderInline(data.q),
                options: await Promise.all(
                  data.options.map(async (o) => ({ text: await renderInline(o.text), correct: !!o.correct, why: await renderInline(o.why) })),
                ),
              };
              ctx.components[i]!.props = `data={${JSON.stringify(rendered)}}`;
            })(),
          );
          parent.children[index] = marker('leaf', i);
          return;
        }
        if (code.lang && EXERCISE_BLOCKS[code.lang]) {
          const kind = code.lang;
          const data = parseYamlBlock<Record<string, unknown>>(ctx, code.value, kind);
          const id = String(data.id ?? `${ctx.slug}/${kind}-${++ctx.exercises}`);
          inlineCircuits(ctx, kind, data);
          const i = ctx.components.push({ tag: `B.${EXERCISE_BLOCKS[kind]}`, props: '' }) - 1;
          ctx.asyncJobs.push(
            (async () => {
              const rendered = await renderFields(data, false, RAW_FIELDS[kind]);
              ctx.components[i]!.props = `spec={${JSON.stringify({ ...rendered, id })}}`;
            })(),
          );
          parent.children[index] = marker('leaf', i);
          return;
        }
        const meta = Object.fromEntries([...(code.meta ?? '').matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
        const html: Html = { type: 'html', value: '' };
        parent.children[index] = html as never;
        ctx.asyncJobs.push(
          highlight(code.value, code.lang).then((h) => {
            const caption = meta.title ? `<figcaption>${meta.title.replace(/</g, '&lt;')}</figcaption>` : '';
            html.value = `<figure class="code-block" data-lang="${code.lang ?? 'text'}">${caption}${h}</figure>`;
          }),
        );
        return;
      }

      case 'image': {
        const img = node as Image;
        if (/^(https?:)?\/\//.test(img.url) || img.url.startsWith('/')) return;
        const imp = addImport(ctx, img.url.startsWith('.') ? img.url : `./${img.url}`, 'img');
        const i = ctx.components.push({ tag: 'img', props: `src={${imp}} alt=${JSON.stringify(img.alt ?? '')} loading="lazy"` }) - 1;
        parent.children[index] = marker('leaf', i) as never;
        return;
      }

      case 'link': {
        const link = node as Link;
        if (link.url.startsWith('/') && !link.url.startsWith('//')) link.url = `§BASE§${link.url}`;
        return;
      }
    }
  });
  await Promise.all(ctx.asyncJobs);
}

async function renderTerms(ctx: Ctx): Promise<Record<string, unknown>> {
  const global = loadYaml<Record<string, RawTerm>>(path.join(ctx.contentRoot, 'terms.yaml'), ctx);
  const out: Record<string, unknown> = {};
  const ids = new Set([...ctx.termRefs, ...Object.keys(ctx.terms)]);
  for (const id of ids) {
    const t = ctx.terms[id] ?? global[id];
    if (!t) {
      console.warn(`[course] ${path.relative(ctx.contentRoot, ctx.file)}: \\term{${id}} has no definition`);
      continue;
    }
    out[id] = {
      label: await renderInline(t.label ?? id),
      what: await renderInline(t.what ?? ''),
      why: await renderInline(t.why),
      effect: await renderInline(t.effect),
      param: t.param,
    };
  }
  return out;
}

export interface CompileResult {
  code: string;
  dependencies: string[];
}

export async function compileMarkdown(source: string, file: string): Promise<CompileResult> {
  const contentRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../content');
  const ctx: Ctx = {
    file,
    dir: path.dirname(file),
    contentRoot,
    components: [],
    imports: [],
    importCount: 0,
    terms: {},
    termRefs: new Set(),
    toc: [],
    slugs: new Map(),
    cites: new Set(),
    glossaryRefs: new Set(),
    equations: 0,
    theorems: 0,
    exercises: 0,
    chapterNumber: '',
    slug: '',
    deps: new Set(),
    asyncJobs: [],
  };

  // Front matter.
  let body = source;
  let front: Record<string, unknown> = {};
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (fm) {
    front = YAML.parse(fm[1]!) ?? {};
    body = source.slice(fm[0].length);
  }
  const dirName = path.basename(ctx.dir);
  const metadata = {
    slug: (front.slug as string) ?? dirName.replace(/^[0-9a-z]{1,2}-/, ''),
    kind: file.includes(`${path.sep}appendices${path.sep}`) ? 'appendix' : 'chapter',
    ...front,
    number: String(front.number ?? ''),
  };
  ctx.chapterNumber = metadata.number;
  ctx.slug = metadata.slug as string;

  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective).parse(body) as Root;
  await transform(tree, ctx);
  const hast = await unified().use(remarkRehype, { allowDangerousHtml: true }).run(tree);
  let html = unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(hast as never);

  // Wide tables scroll sideways inside their own box instead of widening the page on phones
  // (browsers make such a scroller keyboard-focusable themselves).
  html = html.replace(/<table[\s>][\s\S]*?<\/table>/g, (t) => `<div class="table-scroll">${t}</div>`);

  // Everything that is still HTML is static: neutralise Svelte's { } before inserting components.
  html = html.replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
  html = html.replaceAll('§BASE§', '{base}');
  html = html.replace(/<!--§(open|close|leaf):(\d+)-->/g, (_, kind: string, i: string) => {
    const c = ctx.components[Number(i)]!;
    const p = c.props ? ` ${c.props}` : '';
    if (kind === 'open') return `<${c.tag}${p}>`;
    if (kind === 'close') return `</${c.tag}>`;
    return `<${c.tag}${p} />`;
  });

  const terms = await renderTerms(ctx);

  const bib = loadYaml<Record<string, Omit<import('../../src/lib/content/types.ts').Reference, 'key'>>>(path.join(contentRoot, 'bibliography.yaml'), ctx);
  const references = [...ctx.cites].map((key) => {
    if (!bib[key]) console.warn(`[course] missing bibliography entry "${key}"`);
    return { key, ...(bib[key] ?? { authors: '?', year: '?', title: key }) };
  });

  const glossarySrc = loadYaml<Record<string, { term: string; definition: string; chapter?: string }>>(path.join(contentRoot, 'glossary.yaml'), ctx);
  const glossary: Record<string, unknown> = {};
  for (const id of ctx.glossaryRefs) {
    const g = glossarySrc[id];
    if (!g) {
      console.warn(`[course] missing glossary entry "${id}"`);
      continue;
    }
    glossary[id] = { ...g, definition: await renderInline(g.definition) };
  }

  const code = `<script module>
export const metadata = ${JSON.stringify(metadata)};
export const toc = ${JSON.stringify(ctx.toc)};
export const terms = ${JSON.stringify(terms)};
export const references = ${JSON.stringify(references)};
export const glossary = ${JSON.stringify(glossary)};
</script>
<script>
import { base } from '$app/paths';
import * as B from '$lib/components/content';
import * as W from '$lib/widgets';
${ctx.imports.join('\n')}
</script>
${html}
`;
  return { code, dependencies: [...ctx.deps] };
}
