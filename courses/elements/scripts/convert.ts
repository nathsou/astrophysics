// Converts the pinned Perseus TEI of Heath's translation into src/text/data/*.json.
//
//   node scripts/convert.ts          regenerate
//   node scripts/convert.ts --check  fail if the committed output is stale (used by `npm run build`)
//
// Transcription slips in the encoding are corrected before parsing, from errata/*.json: each entry
// names the exact passage and its replacement, and must match exactly once.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elements, find, parseXml, textOf, type XmlElement, type XmlNode } from './xml.ts';
import type { Book, Inline, Item, ItemKind, Note, Para, ParaRole, Section } from '../src/text/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const upstreamFile = join(root, 'upstream/heath/tlg1799.tlg001.perseus-eng2.xml');
const outDir = join(root, 'src/text/data');
const check = process.argv.includes('--check');

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

interface Erratum {
  find: string;
  replace: string;
  reason: string;
}

function applyErrata(src: string): string {
  const dir = join(root, 'errata');
  if (!existsSync(dir)) return src;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const list = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Erratum[];
    for (const e of list) {
      const count = src.split(e.find).length - 1;
      if (count !== 1) throw new Error(`erratum-unmatched: ${f}: ${JSON.stringify(e.find)} occurs ${count} times`);
      src = src.replace(e.find, () => e.replace);
    }
  }
  return src;
}

/** Maps a Perseus citation target (elem.1.c.n.1, elem.10.def.2.3, elem.3.16.p.1) to an item id. */
export function mapTarget(t: string): string | null {
  const m = /^elem\.(\d+)\.(.*)$/.exec(t);
  if (!m) return null;
  const book = Number(m[1]);
  const rest = m[2];
  let r: RegExpExecArray | null;
  if ((r = /^c\.n\.(\d+)$/.exec(rest))) return `${book}.cn.${r[1]}`;
  if ((r = /^post\.(\d+)$/.exec(rest))) return `${book}.post.${r[1]}`;
  if (book === 10 && (r = /^def\.(\d+)\.(\d+)$/.exec(rest))) return `10.def${r[1]}.${r[2]}`;
  if (book === 10 && (r = /^def\.(\d+)$/.exec(rest))) return `10.def1.${r[1]}`;
  if ((r = /^def\.(\d+)$/.exec(rest))) return `${book}.def.${r[1]}`;
  // porisms (p) and lemmas (l) are part of the proposition they follow
  if ((r = /^(\d+)(?:\.[pl]\.\d+)?$/.exec(rest))) return `${book}.${r[1]}`;
  return null;
}

const LABEL = /^[A-Z](?:[A-Z]|\d|′|')*$/;

interface Ctx {
  page: string;
  labels: string[];
  unknown: Set<string>;
  inNote: boolean;
  /** Heath's notes of the item being converted; some are nested inside paragraphs. */
  notes: Note[];
}

function convertNote(note: XmlElement, ctx: Ctx): Note {
  ctx.inNote = true;
  const ps = elements(note, 'p');
  const paras = (ps.length ? ps.map((p) => p.children) : [note.children]).map((c) => trim(inlines(c, ctx))).filter((p) => p.length);
  ctx.inNote = false;
  return { ...(note.attrs.n ? { lemma: note.attrs.n } : {}), paras };
}

function inlines(nodes: XmlNode[], ctx: Ctx): Inline[] {
  const out: Inline[] = [];
  const push = (x: Inline) => {
    if (typeof x === 'string') {
      if (!x) return;
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + x;
      else out.push(x);
    } else out.push(x);
  };
  for (const n of nodes) {
    if (n.kind === 'text') {
      push(n.text.replace(/\s+/g, ' '));
      continue;
    }
    switch (n.name) {
      case 'lb':
      case 'figure':
      case 'milestone':
        break;
      case 'pb':
        ctx.page = n.attrs.n ?? ctx.page;
        break;
      case 'label':
        // "Enunciation", "Proof.", "QED." — added by Perseus; the paragraph role carries this.
        break;
      case 'emph':
      case 'hi': {
        const rend = n.name === 'emph' ? 'italic' : n.attrs.rend;
        const inner = inlines(n.children, ctx);
        if (rend === 'align(center)') {
          // Heath's centred conclusion lines; rendered on a line of their own.
          push({ t: 'centre', c: trim(inner) });
          break;
        }
        const plain = textOf(n).replace(/\s+/g, ' ').trim();
        if (rend === 'italic') {
          // "AB", "AB, CD" and "AC." are labels; anything else is emphasis.
          const lm = /^((?:[A-Z][A-Z0-9′']*)(?:, [A-Z][A-Z0-9′']*)*)([.,;:]?)$/.exec(plain);
          if (lm && lm[1].split(', ').every((l) => LABEL.test(l))) {
            const lead = /^\s/.test(textOf(n)) ? ' ' : '';
            push(lead);
            lm[1].split(', ').forEach((l, i) => {
              if (i) push(', ');
              push({ t: 'label', v: l });
              if (!ctx.inNote && !ctx.labels.includes(l)) ctx.labels.push(l);
            });
            push(lm[2]);
            if (/\s$/.test(textOf(n))) push(' ');
            break;
          }
          push({ t: 'em', c: inner });
          break;
        }
        if (rend === 'bold') {
          push({ t: 'strong', c: inner });
          break;
        }
        ctx.unknown.add(`hi rend=${rend}`);
        for (const x of inner) push(x);
        break;
      }
      case 'ref': {
        const targets = (n.attrs.target ?? '').split(/\s+/).filter(Boolean);
        const mapped = targets.map(mapTarget).filter((x): x is string => !!x);
        const text = textOf(n).replace(/\s+/g, ' ').trim();
        if (mapped.length === 0) {
          ctx.unknown.add(`ref ${n.attrs.target}`);
          push(text);
        } else push({ t: 'ref', to: mapped.join(' '), text });
        break;
      }
      case 'foreign':
        push({ t: 'foreign', lang: n.attrs['xml:lang'] ?? '', c: inlines(n.children, ctx) });
        break;
      case 'quote':
        push({ t: 'quote', c: inlines(n.children, ctx) });
        break;
      case 'title':
      case 'term':
        push({ t: 'em', c: inlines(n.children, ctx) });
        break;
      case 'note':
        ctx.notes.push(convertNote(n, ctx));
        break;
      case 'bibl':
        for (const x of inlines(n.children, ctx)) push(x);
        break;
      default:
        ctx.unknown.add(`<${n.name}>`);
        for (const x of inlines(n.children, ctx)) push(x);
    }
  }
  return out;
}

function trim(c: Inline[]): Inline[] {
  const out = [...c];
  while (typeof out[0] === 'string' && !out[0].trim()) out.shift();
  while (typeof out[out.length - 1] === 'string' && !(out[out.length - 1] as string).trim()) out.pop();
  if (typeof out[0] === 'string') out[0] = out[0].replace(/^\s+/, '');
  const l = out.length - 1;
  if (typeof out[l] === 'string') out[l] = (out[l] as string).replace(/\s+$/, '');
  return out;
}

const plainOf = (c: Inline[]): string =>
  c.map((x) => (typeof x === 'string' ? x : x.t === 'label' ? x.v : x.t === 'ref' ? x.text : plainOf(x.c))).join('');

const isItalic = (n: XmlElement) => n.name === 'emph' || n.name === 'title' || (n.name === 'hi' && n.attrs.rend === 'italic');

/** Beyond Book I the enunciation is not labelled; it is the first paragraph, printed (mostly) in italics. */
function italicShare(p: XmlElement): number {
  let italic = 0;
  let all = 0;
  const walk = (n: XmlNode, inItalic: boolean) => {
    if (n.kind === 'text') {
      const len = n.text.replace(/[\s,.;:]/g, '').length;
      all += len;
      if (inItalic) italic += len;
      return;
    }
    if (n.name === 'note') return;
    const it = isItalic(n) && !LABEL.test(textOf(n).trim());
    for (const c of n.children) walk(c, inItalic || it);
  };
  walk(p, false);
  return all ? italic / all : 0;
}

/** Replaces non-label italic runs by their contents (the enunciation is set in italics as a whole). */
function unwrapItalic(nodes: XmlNode[]): XmlNode[] {
  return nodes.flatMap((n) =>
    n.kind === 'element' && isItalic(n) && !LABEL.test(textOf(n).trim())
      ? unwrapItalic(n.children)
      : n.kind === 'element'
        ? [{ ...n, children: unwrapItalic(n.children) }]
        : [n],
  );
}

function collectCites(c: Inline[], out: string[]) {
  for (const x of c) {
    if (typeof x === 'string') continue;
    if (x.t === 'ref') {
      for (const to of x.to.split(' ')) if (!out.includes(to)) out.push(to);
    } else if (x.t !== 'label') collectCites(x.c, out);
  }
}

function convertItem(div: XmlElement, book: number, kind: ItemKind, group: number | undefined, ctx: Ctx): Item {
  const head = elements(div, 'head')[0];
  const printed = head ? Number(/\d+/.exec(textOf(head))?.[0]) : Number(div.attrs.n);
  const n = Number.isFinite(printed) ? printed : Number(div.attrs.n);
  const id =
    kind === 'prop' ? `${book}.${n}` : kind === 'def' && book === 10 ? `10.def${group}.${n}` : `${book}.${kind}.${n}`;
  ctx.labels = [];
  const paras: Para[] = [];
  ctx.notes = [];
  for (const child of div.children) {
    if (child.kind !== 'element') continue;
    if (child.name === 'pb') {
      ctx.page = child.attrs.n ?? ctx.page;
      continue;
    }
    if (child.name === 'note') {
      ctx.notes.push(convertNote(child, ctx));
      continue;
    }
    // X.42 and a few others print the enunciation as a second heading.
    const secondHead = child.name === 'head' && child !== head && kind === 'prop' && paras.length === 0;
    if (child.name !== 'p' && !secondHead) continue;
    const page = ctx.page;
    const labelEl = find(child, (e) => e.name === 'label');
    const labelText = labelEl ? textOf(labelEl).trim() : '';
    let role: ParaRole = 'text';
    let c: Inline[];
    const italic = kind === 'prop' && paras.length === 0 && (secondHead || italicShare(child) >= 0.6);
    if (labelText === 'Enunciation' || italic) {
      role = 'enunciation';
      c = trim(inlines(italic ? unwrapItalic(child.children) : child.children, ctx));
    } else c = trim(inlines(child.children, ctx));
    if (!c.length) continue;
    const plain = plainOf(c).trim();
    if (/^(Porism|PORISM)\b/.test(plain)) {
      role = 'porism';
    } else if (/^(Lemma|LEMMA)\b/.test(plain)) {
      role = 'lemma';
    } else if (labelText === 'QED.' || /(Q\. ?E\. ?[DF]\.\]?|required to (do|prove)\.)$/.test(plain) && plain.length < 90 && role !== 'enunciation') {
      role = 'qed';
    }
    paras.push({ id: `p${paras.length}`, role, c, ...(page ? { page } : {}) });
  }
  const cites: string[] = [];
  for (const p of paras) collectCites(p.c, cites);
  const all = paras.map((p) => plainOf(p.c)).join(' ');
  const item: Item = { id, book, kind, n, ...(group ? { group } : {}), paras, notes: ctx.notes, cites, labels: [...ctx.labels] };
  if (kind === 'prop') item.problem = /Q\. ?E\. ?F|required to do/.test(all);
  // Heath prints propositions that Heiberg judged interpolated in square brackets.
  if (head && /^\s*\[/.test(textOf(head))) item.bracketed = true;
  return item;
}

const SECTION_TITLES: Record<ItemKind, string> = { def: 'Definitions', post: 'Postulates', cn: 'Common Notions', prop: 'Propositions' };

export function convert(src: string): { books: Book[]; unknown: string[] } {
  const doc = parseXml(applyErrata(src));
  const translation = find(doc, (e) => e.name === 'div' && e.attrs.type === 'translation');
  if (!translation) throw new Error('No translation div');
  const ctx: Ctx = { page: '', labels: [], unknown: new Set(), inNote: false, notes: [] };
  const books: Book[] = [];
  for (const bdiv of elements(translation, 'div')) {
    const bn = Number(bdiv.attrs.n);
    const book: Book = { n: bn, roman: ROMAN[bn], sections: [] };
    for (const tdiv of elements(bdiv, 'div')) {
      const m = /^(def|post|comm_not|prop)(?:_(\d))?$/.exec(tdiv.attrs.n);
      if (!m) throw new Error(`Unknown section ${tdiv.attrs.n}`);
      const kind: ItemKind = m[1] === 'comm_not' ? 'cn' : (m[1] as ItemKind);
      const group = m[2] ? Number(m[2]) : undefined;
      for (const c of tdiv.children) if (c.kind === 'element' && c.name === 'pb') ctx.page = c.attrs.n ?? ctx.page;
      const items: Item[] = [];
      for (const c of tdiv.children) {
        if (c.kind !== 'element') continue;
        if (c.name === 'pb') ctx.page = c.attrs.n ?? ctx.page;
        if (c.name === 'div') items.push(convertItem(c, bn, kind, kind === 'def' ? group : undefined, ctx));
      }
      const groupWord = ['', 'I', 'II', 'III'];
      const title = kind === 'def' && group ? `Definitions ${groupWord[group]}` : SECTION_TITLES[kind];
      const existing = book.sections.find((s) => s.kind === kind && kind === 'prop');
      if (existing) existing.items.push(...items);
      else book.sections.push({ kind, ...(kind === 'def' && group ? { group } : {}), title, items } as Section);
    }
    books.push(book);
  }
  return { books, unknown: [...ctx.unknown].sort() };
}

function main() {
  const src = readFileSync(upstreamFile, 'utf8');
  const { books, unknown } = convert(src);
  const files: Record<string, string> = {};
  for (const b of books) files[`book-${String(b.n).padStart(2, '0')}.json`] = JSON.stringify(b) + '\n';
  const upstream = {
    file: 'upstream/heath/tlg1799.tlg001.perseus-eng2.xml',
    sha256: createHash('sha256').update(src).digest('hex'),
  };
  const index = books.flatMap((b) =>
    b.sections.flatMap((sec) =>
      sec.items.map((it) => {
        const first = it.paras.find((p) => p.role === 'enunciation') ?? it.paras[0];
        return { id: it.id, book: it.book, kind: it.kind, n: it.n, ...(it.group ? { group: it.group } : {}), ...(it.problem !== undefined ? { problem: it.problem } : {}), ...(it.bracketed ? { bracketed: true } : {}), cites: it.cites, text: first ? plainOf(first.c).trim() : '' };
      }),
    ),
  );
  files['index.json'] = JSON.stringify(index) + '\n';
  files['report.json'] = JSON.stringify({ upstream, unknown }, null, 2) + '\n';
  if (unknown.length) console.warn(`Unknown markup: ${unknown.join(', ')}`);
  if (check) {
    const stale = Object.entries(files).filter(([f, v]) => !existsSync(join(outDir, f)) || readFileSync(join(outDir, f), 'utf8') !== v);
    if (stale.length) {
      console.error(`Converted text is stale: ${stale.map(([f]) => f).join(', ')}. Run npm run convert.`);
      process.exit(1);
    }
    if (unknown.length) process.exit(1);
    console.log('Converted text is up to date.');
    return;
  }
  mkdirSync(outDir, { recursive: true });
  for (const [f, v] of Object.entries(files)) writeFileSync(join(outDir, f), v);
  const props = books.reduce((s, b) => s + b.sections.filter((x) => x.kind === 'prop').reduce((t, x) => t + x.items.length, 0), 0);
  console.log(`Wrote ${books.length} books, ${props} propositions.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
