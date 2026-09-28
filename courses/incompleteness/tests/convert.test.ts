import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { convertAll } from '../scripts/convert.ts';
import { assembleDisplay, splitRows } from '../scripts/latex/document.ts';
import { expandMath } from '../scripts/latex/expand.ts';
import { applyErrata } from '../scripts/latex/errata.ts';
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
  it('pairs nested optional arguments as xparse does', () => {
    const norm = (t: string) => expandMath(t, hooks).replace(/\s+/g, ' ').trim();
    expect(norm("\\lforall[x][\\lforall[y][(\\eq[x'][y'] \\lif \\eq[x][y])]]")).toBe("\\forall x \\, \\forall y \\, ( x' = y' \\mathbin{\\rightarrow} x = y )");
    expect(norm("\\lforall[x][\\eq/[\\Obj 0][x']]")).toBe("\\forall x \\, \\mathsfit{0} \\neq x'");
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

describe('errata', () => {
  const errata = () => ({ entries: [{ repo: 'OpenLogic' as const, file: 'a.tex', find: 'L-8', replace: 'L-9', why: '', from: 't.json', applied: 0 }] });
  it('applies a correction that matches exactly once', () => {
    const d: never[] = [];
    expect(applyErrata(errata(), 'OpenLogic', 'a.tex', 'from L-8 and L-12', d)).toBe('from L-9 and L-12');
    expect(d).toEqual([]);
  });
  it('reports a correction that no longer matches, or matches twice', () => {
    const d: { code: string }[] = [];
    applyErrata(errata(), 'OpenLogic', 'a.tex', 'from L-9 and L-12', d as never);
    applyErrata(errata(), 'OpenLogic', 'a.tex', 'L-8, L-8', d as never);
    expect(d.map((x) => x.code)).toEqual(['erratum-unmatched', 'erratum-ambiguous']);
  });
  it('are all applied to the book', () => {
    expect(diagnostics.filter((x) => x.code.startsWith('erratum'))).toEqual([]);
  });
});

describe('display splitting', () => {
  it('does not split inside a macro’s bracketed argument', () => {
    expect(splitRows('\\lexists[u][(A \\\\ B)] \\\\ C')).toEqual(['\\lexists[u][(A \\\\ B)]', 'C']);
    expect(splitRows('[0, 1) \\\\ x')).toEqual(['[0, 1)', 'x']);
  });
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

  it('keeps inline \\iftag text inside list items (the connectives in B.1)', () => {
    const fol = JSON.stringify(chapters.find((c) => c.id === 'ic.fol'));
    expect(fol).toContain('universal quantifier');
    expect(fol).toContain('existential quantifier');
    expect(diagnostics.filter((d) => d.code === 'list-junk')).toEqual([]);
  });

  it('numbers every numbered block with its chapter (including text written in ic.tex)', () => {
    const bad: string[] = [];
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        const o = x as { t?: string; number?: string; id?: string };
        if (o.t === 'env' && o.number !== undefined && !/^[0-9A-Z]+\.\d+$/.test(o.number)) bad.push(`${o.id}: ${o.number}`);
        Object.values(o).forEach(walk);
      }
    };
    walk(chapters);
    expect(bad).toEqual([]);
  });

  it('is committed and up to date (run npm run convert)', () => {
    for (const [name, content] of files) expect(readFileSync(join(root, 'src/content/source', name), 'utf8') === content, name).toBe(true);
  });

  it('follows the book’s structure and numbering from ic.tex', () => {
    expect(index.chapters.map((c) => [c.id, c.number])).toEqual([
      ['ic.preface', ''], ['inc.int', '1'], ['cmp.rec', '2'], ['inc.art', '3'], ['inc.req', '4'], ['inc.inp', '5'], ['ic.comp-inc', '6'], ['ic.mod', '7'],
      ['ic.sol', '8'], ['ic.lambda', '9'], ['ic.deriv', 'A'], ['ic.fol', 'B'], ['ic.nd', 'C'], ['ic.bios', 'D'],
    ]);
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
