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
 *   ::exercise{id="utf8-encode"}             in-browser coding exercise (./exercises/<id>/index.ts)
 *   ::some-widget{prop=1 other="x"}          any Svelte widget (./widgets/SomeWidget.svelte or $lib/widgets)
 *   :sidenote[margin note]  :cite[key1,key2]  :term[glossary word]{id=…}
 *
 * Fenced blocks with language `terms` define hover docs for \term{id}{…} symbols; `quiz`
 * blocks become multiple-choice questions.
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
  deps: Set<string>;
  asyncJobs: Promise<void>[];
}

const CALLOUTS = new Set(['note', 'tip', 'warning', 'info', 'lab', 'breakit', 'challenge', 'exercises', 'definition', 'key', 'question', 'aside']);
const TEXT_DIRECTIVES = new Set(['sidenote', 'cite', 'term', 'kbd']);
const BUILTIN_BLOCKS: Record<string, string> = {
  history: 'History',
  equation: 'Equation',
  details: 'Details',
  figure: 'Figure',
  columns: 'Columns',
};

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
    if (node.type === 'link' && node.url.startsWith('/') && !node.url.startsWith('//')) node.url = `__COURSE_BASE__${node.url}`;
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

/** Parse a fenced YAML block with an error message that points at the chapter and the usual culprit. */
function parseYamlBlock<T>(ctx: Ctx, src: string, kind: string): T {
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
    ctx.components[i] = { tag: 'B.ReferenceList', props: `items={withBase(${JSON.stringify(items)})}` };
  } else if (name === 'all-glossary') {
    const g = loadYaml<Record<string, { term: string; definition: string; chapter?: string }>>(path.join(ctx.contentRoot, 'glossary.yaml'), ctx);
    const items = await Promise.all(
      Object.entries(g).map(async ([id, e]) => ({ id, term: e.term, chapter: e.chapter, definition: await renderInline(e.definition) })),
    );
    items.sort((a, b) => a.term.localeCompare(b.term));
    ctx.components[i] = { tag: 'B.GlossaryList', props: `items={withBase(${JSON.stringify(items)})}` };
  } else {
    const t = loadYaml<{ year: number; title: string; people?: string; chapter?: string; text: string }[]>(path.join(ctx.contentRoot, 'timeline.yaml'), ctx);
    const items = await Promise.all((Array.isArray(t) ? t : []).map(async (e) => ({ ...e, text: await renderInline(e.text) })));
    items.sort((a, b) => a.year - b.year);
    ctx.components[i] = { tag: 'B.Timeline', props: `items={withBase(${JSON.stringify(items)})}` };
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
  } else if (name === 'exercise') {
    const id = attrs.id;
    if (!id) throw new Error(`${ctx.file}: ::exercise needs an id`);
    const spec = `./exercises/${id}/index.ts`;
    if (!existsSync(path.join(ctx.dir, spec))) throw new Error(`${ctx.file}: missing exercise ${spec}`);
    const imp = addImport(ctx, spec, 'ex');
    ctx.components.push({ tag: 'B.Exercise', props: `spec={${imp}}` });
    parent.children.splice(index, 1, marker('leaf', ctx.components.length - 1));
    return index + 1;
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
              ctx.components[i]!.props = `data={withBase(${JSON.stringify(rendered)})}`;
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
        if (link.url.startsWith('/') && !link.url.startsWith('//')) link.url = `__COURSE_BASE__${link.url}`;
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

/**
 * Put every GFM table in a horizontal scroller so wide tables scroll instead of widening the page on phones.
 * Like Shiki's <pre>, the scroller is focusable so it can be scrolled from the keyboard.
 */
function wrapTables(hast: Parent): void {
  visit(hast as never, 'element', (node: { tagName: string }, index: number | undefined, parent: Parent | undefined) => {
    if (node.tagName !== 'table' || index === undefined || !parent) return;
    const wrapper = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Table' },
      children: [node],
    };
    parent.children.splice(index, 1, { type: 'comment', value: ' svelte-ignore a11y_no_noninteractive_tabindex ' } as never, wrapper as never);
    return index + 2;
  });
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

  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective).parse(body) as Root;
  // A paragraph consisting of $$…$$ is display math even when written on one line.
  visit(tree, 'paragraph', (node, index, parent) => {
    const child = node.children[0];
    const raw = body.slice(node.position?.start.offset, node.position?.end.offset).trim();
    if (parent && index !== undefined && node.children.length === 1 && child?.type === 'inlineMath' && raw.startsWith('$$') && raw.endsWith('$$')) {
      parent.children[index] = { type: 'math', value: child.value, position: node.position } as never;
    }
  });
  visit(tree, (node) => {
    if (node.type === 'containerDirective' && ['equation', 'figure'].includes(node.name) && node.attributes?.id) ctx.slugs.set(node.attributes.id, 1);
  });
  await transform(tree, ctx);
  const hast = await unified().use(remarkRehype, { allowDangerousHtml: true }).run(tree);
  wrapTables(hast as unknown as Parent);
  let html = unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(hast as never);

  // Everything that is still HTML is static: neutralise Svelte's { } before inserting components.
  html = html.replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
  html = html.replaceAll('__COURSE_BASE__', '{base}');
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
import { base } from '$app/paths';
/** @param {any} value @returns {any} */
function withBase(value) {
  if (typeof value === 'string') return value.replaceAll('__COURSE_BASE__', base);
  if (Array.isArray(value)) return value.map(withBase);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, withBase(val)]));
  return value;
}
export const metadata = ${JSON.stringify(metadata)};
export const toc = ${JSON.stringify(ctx.toc)};
export const terms = withBase(${JSON.stringify(terms)});
export const references = ${JSON.stringify(references)};
export const glossary = withBase(${JSON.stringify(glossary)});
</script>
<script>
import * as B from '$lib/components/content';
import * as W from '$lib/widgets';
${ctx.imports.join('\n')}
</script>
${html}
`;
  return { code, dependencies: [...ctx.deps] };
}
