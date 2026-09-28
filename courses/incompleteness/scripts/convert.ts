// Converts the vendored upstream LaTeX (upstream/) into structured JSON (src/content/source/).
//
//   npm run convert          regenerate src/content/source/
//   npm run convert:check    fail if the committed JSON is stale or the conversion has errors
//
// The output is committed so that an upstream update shows up as a reviewable diff.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOverrides, emptyConfig, readConfig } from './latex/macros.ts';
import { convertBook, plain, type ConvertContext } from './latex/document.ts';
import type { Block, Chapter, Inline, LabelTarget, SearchEntry, SourceIndex } from '../src/content/schema.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const upstreamDir = join(root, 'upstream');
const outDir = join(root, 'src', 'content', 'source');
const check = process.argv.includes('--check');

export function convertAll() {
  const config = emptyConfig();
  readConfig(config, readFileSync(join(upstreamDir, 'OpenLogic', 'open-logic-config.sty'), 'utf8'), 'OpenLogic/open-logic-config.sty');
  readConfig(config, readFileSync(join(upstreamDir, 'incompleteness-computability', 'ic-config.sty'), 'utf8'), 'incompleteness-computability/ic-config.sty');
  applyOverrides(config);

  let known = new Map<string, LabelTarget>();
  let result: { chapters: Chapter[]; ctx: ConvertContext } | null = null;
  // Two passes: the first collects labels so that forward references resolve in the second.
  for (let pass = 0; pass < 2; pass++) {
    const ctx: ConvertContext = { upstreamDir, config, diagnostics: [], used: new Map(), labels: new Map(), knownLabels: known, suppressedEnvs: new Set() };
    const chapters = convertBook(ctx);
    known = ctx.labels;
    result = { chapters, ctx };
  }
  const { chapters, ctx } = result!;

  // Unresolved references.
  const refs = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.t === 'ref') refs.add(o.key as string);
      Object.values(o).forEach(walk);
    }
  };
  walk(chapters);
  for (const key of refs) {
    if (!ctx.labels.has(key)) ctx.diagnostics.push({ level: 'warning', code: 'external-ref', message: `reference to ${key}, which is outside the converted chapters` });
  }

  const manifest = JSON.parse(readFileSync(join(upstreamDir, 'UPSTREAM.json'), 'utf8'));
  const index: SourceIndex = {
    generatedFrom: Object.fromEntries(Object.entries(manifest.repositories as Record<string, { url: string; commit: string }>).map(([k, v]) => [k, { url: v.url, commit: v.commit }])),
    chapters: chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, file: `${c.id}.json`, sections: c.sections.map((s) => ({ id: s.id, number: s.number, title: s.titleText })) })),
    labels: Object.fromEntries([...ctx.labels].sort(([a], [b]) => a.localeCompare(b))),
    macros: [...ctx.used].map(([name, u]) => ({ name, count: u.count, origin: u.origin })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
  const files = new Map<string, string>();
  files.set('search.json', JSON.stringify(searchIndex(chapters)) + '\n');
  for (const c of chapters) files.set(`${c.id}.json`, JSON.stringify(c, null, 1) + '\n');
  files.set('index.json', JSON.stringify(index, null, 1) + '\n');
  files.set('report.json', JSON.stringify({ diagnostics: ctx.diagnostics }, null, 1) + '\n');
  return { files, diagnostics: ctx.diagnostics };
}

const ENV_NAME: Partial<Record<Block extends infer B ? (B extends { t: 'env'; kind: infer K } ? K & string : never) : never, string>> = {
  defn: 'Definition', thm: 'Theorem', lem: 'Lemma', prop: 'Proposition', cor: 'Corollary', ex: 'Example', prob: 'Problem',
};

/** Numbered blocks and the terms their definitions introduce, for the site's search. */
function searchIndex(chapters: Chapter[]): SearchEntry[] {
  const out: SearchEntry[] = [];
  const anchor = (id: string) => id.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const blockText = (bs: Block[]): string =>
    bs
      .map((b) => (b.t === 'p' ? plain(b.c) : b.t === 'list' ? b.items.map((i) => blockText(i.c)).join(' ') : b.t === 'env' ? blockText(b.c) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  const emphs = (x: unknown, acc: Inline[][]) => {
    if (Array.isArray(x)) x.forEach((y) => emphs(y, acc));
    else if (x && typeof x === 'object') {
      const o = x as { t?: string; c?: Inline[] };
      if (o.t === 'em' && o.c) acc.push(o.c);
      else Object.values(o).forEach((v) => emphs(v, acc));
    }
  };
  for (const c of chapters) {
    for (const s of c.sections) {
      for (const b of s.blocks) {
        if (b.t !== 'env' || !ENV_NAME[b.kind] || !b.number) continue;
        const text = blockText(b.c);
        const a = anchor(b.label ?? b.id);
        // The label's last part often names the result ("lem:fixed-point"): searchable keywords.
        const keys = b.label ? b.label.split(':').pop()!.replace(/[-_]+/g, ' ') : undefined;
        out.push({ kind: b.kind, head: `${ENV_NAME[b.kind]} ${b.number}`, title: b.title ? plain(b.title) : undefined, text: text.length > 220 ? text.slice(0, 217).replace(/\s\S*$/, '') + '…' : text, keys, sectionId: s.id, anchor: a });
        if (b.kind === 'defn') {
          const ems: Inline[][] = [];
          emphs(b.c, ems);
          for (const e of ems) {
            const term = plain(e);
            if (term.length > 1 && term.length < 60) out.push({ kind: 'term', head: term, text: `${ENV_NAME.defn} ${b.number}${b.title ? ` (${plain(b.title)})` : ''}`, sectionId: s.id, anchor: a });
          }
        }
      }
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { files, diagnostics } = convertAll();
  const errors = diagnostics.filter((d) => d.level === 'error');
  const warnings = diagnostics.filter((d) => d.level === 'warning');
  for (const d of [...errors, ...warnings]) {
    const where = d.loc ? `${d.loc.repo}/${d.loc.file}:${d.loc.line}` : '';
    console.log(`${d.level.padEnd(7)} ${d.code.padEnd(20)} ${where} ${d.message}`);
  }
  console.log(`${files.size} files, ${errors.length} errors, ${warnings.length} warnings, ${diagnostics.length - errors.length - warnings.length} notes`);
  if (check) {
    const stale = [...files].filter(([name, content]) => !existsSync(join(outDir, name)) || readFileSync(join(outDir, name), 'utf8') !== content);
    const extra = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.json') && !files.has(f)) : [];
    if (stale.length || extra.length) {
      console.error(`src/content/source is out of date (${[...stale.map(([n]) => n), ...extra].join(', ')}); run npm run convert`);
      process.exit(1);
    }
    if (errors.length) process.exit(1);
  } else {
    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(outDir)) if (f.endsWith('.json') && !files.has(f)) rmSync(join(outDir, f));
    for (const [name, content] of files) writeFileSync(join(outDir, name), content);
  }
}
