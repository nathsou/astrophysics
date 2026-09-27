import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { convertAll } from '../scripts/convert.ts';
import { assembleDisplay, splitRows } from '../scripts/latex/document.ts';
import { expandMath } from '../scripts/latex/expand.ts';
import { applyOverrides, emptyConfig, parseArgSpec, readConfig } from '../scripts/latex/macros.ts';
import type { Block, Chapter, Inline, SourceIndex } from '../src/content/schema.ts';

const root = join(__dirname, '..');
const { files, diagnostics } = convertAll();
const chapters = [...files].filter(([n]) => n !== 'index.json' && n !== 'report.json').map(([, c]) => JSON.parse(c) as Chapter);
const index = JSON.parse(files.get('index.json')!) as SourceIndex;

function config() {
  const c = emptyConfig();
  readConfig(c, readFileSync(join(root, 'upstream/OpenLogic/open-logic-config.sty'), 'utf8'), 'ol');
  readConfig(c, readFileSync(join(root, 'upstream/incompleteness-computability/ic-config.sty'), 'utf8'), 'ic');
  applyOverrides(c);
  return c;
}

describe('macro layer', () => {
  const cfg = config();
  const hooks = { config: cfg, used: new Map(), refText: () => '??', qualify: (_o: unknown[], l: string) => l, warn: () => {} };
  it('parses xparse argument specifications', () => {
    expect(parseArgSpec('t{/} o o')).toEqual([{ kind: 't', char: '/' }, { kind: 'o' }, { kind: 'o' }]);
    expect(parseArgSpec('m d() o')).toEqual([{ kind: 'm' }, { kind: 'd', open: '(', close: ')' }, { kind: 'o' }]);
  });
  it('expands Open Logic macros from the upstream definitions', () => {
    expect(expandMath('\\lforall[x][!A(x)]', hooks).replace(/\s+/g, ' ').trim()).toBe('\\forall x \\, A(x)');
    expect(expandMath('\\eq/[t_1][t_2]', hooks).replace(/\s+/g, ' ').trim()).toBe('t_1 \\neq t_2');
    expect(expandMath('\\Th{Q} \\Proves/ !A', hooks).replace(/\s+/g, ' ').trim()).toBe('\\mathbf{Q} \\nvdash A');
    expect(expandMath('\\num{n}', hooks)).toBe('\\overline{n}');
    expect(expandMath('\\gn{!A}', hooks).replace(/\s+/g, ' ').trim()).toBe('\\ulcorner A \\urcorner');
  });
  it('uses latin formula letters, as ic-config.sty asks', () => {
    expect(cfg.formulaLetters).toBeNull();
  });
  it('never fuses a control word with a following letter', () => {
    expect(expandMath('\\lnot!A', hooks)).toBe('\\lnot A');
  });
  it('takes the book’s terminology tokens (enumerable → countable)', () => {
    expect(cfg.tokens.get('enumerable')!.s).toBe('countable');
  });
});

describe('display splitting', () => {
  it('splits rows at top level only', () => {
    expect(splitRows('a & b \\\\ \\begin{cases} x \\\\ y \\end{cases} & c')).toHaveLength(2);
  });
  it('assembles a numbered align for KaTeX', () => {
    expect(assembleDisplay('align', [{ tex: 'a &= b', tag: '4.1' }, { tex: 'c &= d' }])).toBe('\\begin{align*}a &= b \\tag{4.1} \\\\ c &= d\\end{align*}');
  });
});

describe('conversion of the vendored chapters', () => {
  it('has no errors', () => {
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('is committed and up to date (run npm run convert)', () => {
    for (const [name, content] of files) expect(readFileSync(join(root, 'src/content/source', name), 'utf8') === content, name).toBe(true);
  });

  it('follows the book’s chapter numbering from ic.tex', () => {
    expect(index.chapters.map((c) => [c.id, c.number])).toEqual([['cmp.rec', '2'], ['inc.art', '3'], ['inc.req', '4'], ['inc.inp', '5']]);
  });

  it('numbers theorem-like environments per chapter with a shared counter', () => {
    const art = chapters.find((c) => c.id === 'inc.art')!;
    const cod = art.sections.find((s) => s.id === 'inc.art.cod')!;
    const envs = cod.blocks.filter((b): b is Extract<Block, { t: 'env' }> => b.t === 'env' && !!b.number);
    expect(envs.map((e) => `${e.kind} ${e.number}`)).toEqual(['defn 3.1', 'prop 3.2', 'defn 3.3', 'ex 3.4']);
    expect(index.labels['inc:art:trm:prop:term-primrec'].text).toBe('Proposition 3.5');
  });

  it('keeps source locations', () => {
    const fix = chapters.find((c) => c.id === 'inc.inp')!.sections.find((s) => s.id === 'inc.inp.fix')!;
    const lem = fix.blocks.find((b) => b.t === 'env' && b.kind === 'lem')!;
    expect(lem.loc.file).toBe('content/incompleteness/incompleteness-provability/fixed-point-lemma.tex');
    const src = readFileSync(join(root, 'upstream/OpenLogic', lem.loc.file), 'utf8').split('\n');
    expect(src[lem.loc.line - 1]).toContain('\\begin{lem}');
    expect(src[lem.loc.endLine - 1]).toContain('\\end{lem}');
  });

  it('resolves every internal reference', () => {
    const refs: string[] = [];
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        const o = x as Inline;
        if (o.t === 'ref') refs.push(o.key);
        Object.values(o).forEach(walk);
      }
    };
    walk(chapters);
    const unresolved = refs.filter((r) => !index.labels[r]);
    const external = diagnostics.filter((d) => d.code === 'external-ref').map((d) => d.message);
    for (const r of unresolved) expect(external.some((m) => m.includes(r)), r).toBe(true);
  });

  it('produces mathematics that KaTeX renders', () => {
    let count = 0;
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (o.t === 'math') {
          count++;
          expect(() => katex.renderToString(o.tex as string, { throwOnError: true, strict: false })).not.toThrow();
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(chapters);
    expect(count).toBeGreaterThan(1000);
  });
});
