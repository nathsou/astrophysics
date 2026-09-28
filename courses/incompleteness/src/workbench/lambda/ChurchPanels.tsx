// Church numerals, arithmetic, pairs and truth values (chapter "Lambda Definability"): build the
// book's terms, reduce them by normal order in the background, and read the results back.

import { useMemo, useState, type ReactNode } from 'react';
import {
  BOOK_DEFS,
  app,
  apps,
  labelTex,
  walk,
  booleanValue,
  churchBoolean,
  churchNumeral,
  combinator,
  decodePair,
  numeralValue,
  parseLambda,
  tryParseLambda,
  variable,
  type Term,
} from '../../engine/lambda/lambda';
import { Panel } from '../coding';
import { Prov, NotAProof } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { useReduction, statusText } from './run';
import { LABELS, SendToLab, TermTex, clampInt, useParsedLambda, ParseError } from './shared';
import './lambda.css';

// ------------------------------------------------------------------ reading results

export type Reading = { kind: 'numeral'; n: number } | { kind: 'boolean'; b: boolean } | { kind: 'pair'; a: Term; b: Term } | { kind: 'other' };

export function read(t: Term, pairs = false): Reading {
  const n = numeralValue(t);
  if (n !== null) return { kind: 'numeral', n };
  const b = booleanValue(t);
  if (b !== null) return { kind: 'boolean', b };
  if (pairs) {
    const p = decodePair(t, { normalize: false });
    if (p) return { kind: 'pair', a: p[0], b: p[1] };
  }
  return { kind: 'other' };
}

export function readingTex(r: Reading): string {
  switch (r.kind) {
    case 'numeral':
      return `\\overline{${r.n}}`;
    case 'boolean':
      return `\\mathrm{${r.b}}`;
    default:
      return '';
  }
}

/** The outcome of reducing `term` by normal order: running, or the normal form read back (or an honest "no normal form within N steps"). */
export function Outcome({ term, fuel = 20_000, expect, pairs, compact, zeroIsFalse, raw }: { term: Term | null; fuel?: number; expect?: number | boolean; pairs?: boolean; compact?: boolean; zeroIsFalse?: boolean; raw?: boolean }) {
  const st = useReduction(term, fuel);
  if (!term || !st) return null;
  if (st.phase === 'running') return <span className="lam-steps-inline">reducing… {st.count > 0 ? `${st.count} steps` : ''}</span>;
  if (st.status !== 'normal-form') return <span className="lam-status warn" style={{ display: 'inline-block', margin: 0, padding: '2px 8px' }}>{compact ? `no normal form within ${st.count} steps` : statusText(st.status, st.count)}</span>;
  let r: Reading = raw ? { kind: 'other' } : read(st.final, pairs);
  // 0̄ and false are the same term (λf x.x ≡α λx y.y); read it as the kind expected.
  if (r.kind === 'numeral' && r.n === 0 && (typeof expect === 'boolean' || zeroIsFalse)) r = { kind: 'boolean', b: false };
  const ok = expect === undefined ? null : (typeof expect === 'number' && r.kind === 'numeral' && r.n === expect) || (typeof expect === 'boolean' && r.kind === 'boolean' && r.b === expect);
  return (
    <span className="lam-outcome">
      {r.kind === 'numeral' && r.n === 0 && expect === undefined && !zeroIsFalse ? (
        <Tex tex="\overline{0} \equiv \mathrm{false}" />
      ) : r.kind === 'numeral' || r.kind === 'boolean' ? (
        <Tex tex={readingTex(r)} />
      ) : r.kind === 'pair' ? (
        <Tex tex={`\\langle ${readingOf(r.a)}, ${readingOf(r.b)} \\rangle`} />
      ) : (
        <>
          <TermTex term={st.final} opts={raw ? { labels: true } : LABELS} /> {!raw && <span className="lam-steps-inline">(normal, but not a numeral or truth value)</span>}
        </>
      )}{' '}
      <span className="lam-steps-inline">
        in {st.count} step{st.count === 1 ? '' : 's'}
        {ok === true && <span style={{ color: 'var(--checked)' }}> ✓ as expected</span>}
        {ok === false && <span style={{ color: 'var(--danger)' }}> ✗ expected {String(expect)}</span>}
      </span>
    </span>
  );
}

function readingOf(t: Term): string {
  const r = read(t);
  if (r.kind === 'numeral' || r.kind === 'boolean') return readingTex(r);
  return '\\ldots';
}

function NumIn({ value, onChange, label, max }: { value: number; onChange: (n: number) => void; label: ReactNode; max: number }) {
  return (
    <label>
      {label}
      <input className="lam-num-input" type="number" min={0} max={max} value={value} onChange={(e) => onChange(clampInt(e.target.value, 0, max, 0))} />
    </label>
  );
}

// ------------------------------------------------------------------ numerals

/** n̄ ≡ λf x.fⁿ(x), and n̄ applied to a function and an argument. */
export function NumeralPanel() {
  const [n, setN] = useState(3);
  const num = useMemo(() => churchNumeral(n), [n]);
  const applied = useMemo(() => apps(churchNumeral(n), variable('g'), variable('a')), [n]);
  return (
    <Panel n="n̄" title="Church numerals" prov={<Prov kind="computed" />}>
      <div className="lam-row">
        <NumIn value={n} onChange={setN} label="n =" max={12} />
      </div>
      <dl className="lam-kv">
        <dt>
          <Tex tex={`\\overline{${n}}`} />
        </dt>
        <dd>
          <TermTex term={num} />
        </dd>
        <dt>official syntax</dt>
        <dd>
          <TermTex term={num} opts={{ parens: 'full' }} />
        </dd>
        <dt>
          <Tex tex={`\\overline{${n}}\\, g\\, a`} />
        </dt>
        <dd>
          <AppliedResult term={applied} />
        </dd>
      </dl>
      <p className="wb-note">A Church numeral is an iterator: applied to any g and a it applies g to a exactly n times. It is in normal form — no redex inside.</p>
    </Panel>
  );
}

function AppliedResult({ term }: { term: Term }) {
  const st = useReduction(term, 200);
  if (!st || st.phase === 'running') return <span className="lam-steps-inline">reducing…</span>;
  return (
    <>
      <TermTex term={st.final} /> <span className="lam-steps-inline">({st.count} steps)</span>
    </>
  );
}

// ------------------------------------------------------------------ a function table

/** Which function does F λ-define (on a few inputs)? F n̄ (or F m̄ n̄) is reduced for each input. */
export function FunctionTable({ initial = 'λx. 3', arity = 1, expected, inputs, title = 'What does F λ-define?', note }: { initial?: string; arity?: 1 | 2; expected?: string; inputs?: number[][]; title?: string; note?: ReactNode }) {
  const [src, setSrc] = useState(initial);
  const parsed = useParsedLambda(src);
  const rows = inputs ?? (arity === 1 ? [[0], [1], [2], [3], [4]] : [[0, 0], [1, 2], [2, 3], [3, 1], [4, 0]]);
  const f = expected ? makeExpected(expected) : null;
  return (
    <Panel n="F" title={title} prov={<Prov kind="computed" />}>
      <label className="fi-label" htmlFor="lam-ft-in">
        F
      </label>
      <input id="lam-ft-in" className={`lam-field ${parsed.ok ? '' : 'invalid'}`} value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} autoCapitalize="off" />
      <ParseError src={src} r={parsed} />
      {note && <p className="wb-note">{note}</p>}
      {parsed.ok && (
        <div className="lam-table-wrap">
          <table className="lam-table">
            <thead>
              <tr>
                <th scope="col">input</th>
                <th scope="col">normal form of F applied to it (normal order)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ns) => (
                <FTRow key={ns.join(',')} f={parsed.value} ns={ns} expect={f ? f(ns) : undefined} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NotAProof>A table of finitely many values shows what F does on these inputs. That F λ-defines a function means it does so for every input — which needs an argument.</NotAProof>
    </Panel>
  );
}

function makeExpected(expr: string): ((ns: number[]) => number) | null {
  // expected values for a few named functions
  const table: Record<string, (ns: number[]) => number> = {
    'x+1': ([x]) => x! + 1,
    'x+y': ([x, y]) => x! + y!,
    'x*y': ([x, y]) => x! * y!,
    'x^y': ([x, y]) => x! ** y!,
    'x-1': ([x]) => Math.max(0, x! - 1),
    'x-y': ([x, y]) => Math.max(0, x! - y!),
  };
  return table[expr] ?? null;
}

function FTRow({ f, ns, expect }: { f: Term; ns: number[]; expect?: number }) {
  const t = useMemo(() => ns.reduce<Term>((acc, n) => app(acc, churchNumeral(n)), f), [f, ns]);
  return (
    <tr>
      <td>
        <Tex tex={ns.map((n) => `\\overline{${n}}`).join('\\ ')} />
      </td>
      <td>
        <Outcome term={t} expect={expect} compact />
      </td>
    </tr>
  );
}

// ------------------------------------------------------------------ arithmetic

interface Op {
  key: string;
  label: string;
  src: string;
  arity: 1 | 2;
  f: (a: number, b: number) => number;
  cap: (a: number, b: number) => boolean;
  note?: ReactNode;
}

const OPS: Op[] = [
  { key: 'Succ', label: 'Succ', src: 'Succ', arity: 1, f: (a) => a + 1, cap: (a) => a <= 30 },
  { key: "Succ'", label: 'Succ′ (exercise)', src: "Succ'", arity: 1, f: (a) => a + 1, cap: (a) => a <= 30 },
  { key: 'Add', label: 'Add', src: 'Add', arity: 2, f: (a, b) => a + b, cap: (a, b) => a + b <= 40 },
  { key: "Add'", label: 'Add′', src: "Add'", arity: 2, f: (a, b) => a + b, cap: (a, b) => a + b <= 40 },
  { key: 'Mult', label: 'Mult', src: 'Mult', arity: 2, f: (a, b) => a * b, cap: (a, b) => a * b <= 64 },
  { key: "Mult'", label: 'Mult′', src: "Mult'", arity: 2, f: (a, b) => a * b, cap: (a, b) => a * b <= 36 && a <= 8 },
  {
    key: 'Exp',
    label: 'Exp',
    src: 'Exp',
    arity: 2,
    f: (a, b) => a ** b,
    cap: (a, b) => a ** b <= 128,
    note: (
      <div className="lam-aside">
        <Prov kind="added" /> The exponent (the second argument) must be at least 1: <Tex tex="\mathrm{Exp}\,\overline a\,\overline 0 \twoheadrightarrow \overline 0\,\overline a \twoheadrightarrow \lambda x.\,x" />, which is not the numeral <Tex tex="\overline 1 \equiv \lambda f x.\,f x" /> (it is only η-equivalent to it). <Tex tex="\mathrm{Exp}'" /> gives <Tex tex="\overline 1" />.
      </div>
    ),
  },
  { key: "Exp'", label: 'Exp′', src: "Exp'", arity: 2, f: (a, b) => a ** b, cap: (a, b) => a ** b <= 64 },
  { key: 'Pred', label: 'Pred', src: 'Pred', arity: 1, f: (a) => Math.max(0, a - 1), cap: (a) => a <= 12 },
  { key: 'Sub', label: 'Sub', src: 'Sub', arity: 2, f: (a, b) => Math.max(0, a - b), cap: (a, b) => a <= 12 && b <= 8 },
];

/** The book's arithmetical terms applied to numerals, reduced and read back. */
export function ArithmeticPanel({ ops }: { ops?: string[] }) {
  const list = ops ? OPS.filter((o) => ops.includes(o.key)) : OPS;
  const [key, setKey] = useState(list[0]!.key);
  const op = list.find((o) => o.key === key) ?? list[0]!;
  const [a, setA] = useState(2);
  const [b, setB] = useState(3);
  const ok = op.cap(a, b);
  const src = op.arity === 1 ? `(${op.src}) ${a}` : `(${op.src}) ${a} ${b}`;
  const term = useMemo(() => (ok ? parseLambda(src) : null), [src, ok]);
  const defTerm = useMemo(() => {
    const d = BOOK_DEFS[op.src];
    const r = tryParseLambda(d && typeof d.src === 'string' ? d.src : op.src);
    return r.ok ? r.value : null;
  }, [op]);
  const hasNames = useMemo(() => {
    let named = false;
    if (defTerm) walk(defTerm, (x) => (named ||= x.label !== undefined && numeralValue(x) === null));
    return named;
  }, [defTerm]);
  return (
    <Panel n="+" title="Arithmetic on Church numerals" prov={<Prov kind="computed" />}>
      <div className="lam-row">
        <select className="lam-select" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Function">
          {list.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <NumIn value={a} onChange={setA} label={op.arity === 1 ? 'n =' : 'a ='} max={30} />
        {op.arity === 2 && <NumIn value={b} onChange={setB} label="b =" max={30} />}
      </div>
      {op.note}
      {defTerm && (
        <dl className="lam-kv">
          <dt>{op.src.startsWith('λ') ? 'term' : <Tex tex={labelTex(op.src)} />}</dt>
          <dd>
            <TermTex term={defTerm} opts={LABELS} />
          </dd>
          {hasNames && (
            <>
              <dt>unfolded</dt>
              <dd>
                <TermTex term={defTerm} opts={{ numerals: true }} />
              </dd>
            </>
          )}
        </dl>
      )}
      {!ok ? (
        <p className="wb-note danger">These inputs are too large for this panel (the terms grow quickly). Try smaller numbers.</p>
      ) : (
        term && (
          <>
            <dl className="lam-kv">
              <dt>term</dt>
              <dd>
                <TermTex term={term} opts={LABELS} />
              </dd>
              <dt>normal form</dt>
              <dd>
                <Outcome term={term} expect={op.f(a, b)} />
              </dd>
            </dl>
            <SendToLab src={src} />
          </>
        )
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ pairs and predecessor

/** Pairs, and the predecessor's iteration ⟨0̄,0̄⟩ → ⟨0̄,1̄⟩ → ⟨1̄,2̄⟩ → … */
export function PairsPanel() {
  const [n, setN] = useState(3);
  const stepFn = useMemo(() => parseLambda('λp. ⟨Snd p, Succ (Snd p)⟩'), []);
  const rows = useMemo(() => {
    const out: { k: number; term: Term }[] = [];
    let t: Term = parseLambda('⟨0, 0⟩');
    for (let k = 0; k <= n; k++) {
      out.push({ k, term: t });
      t = app(stepFn, t);
    }
    return out;
  }, [n, stepFn]);
  const pred = useMemo(() => parseLambda(`Pred ${n}`), [n]);
  return (
    <Panel n="⟨⟩" title="Pairs and the predecessor" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="\mathrm{Pred}\,\overline n" /> applies the step <Tex tex="D \equiv \lambda p.\,\langle \mathrm{Snd}\,p, \mathrm{Succ}(\mathrm{Snd}\,p)\rangle" /> to <Tex tex="\langle\overline 0,\overline 0\rangle" />, <i>n</i> times, and takes the first component. Here are the pairs it passes through:
      </p>
      <div className="lam-row">
        <NumIn value={n} onChange={setN} label="n =" max={8} />
      </div>
      <div className="lam-table-wrap">
        <table className="lam-table">
          <thead>
            <tr>
              <th scope="col">k</th>
              <th scope="col">
                <Tex tex="D^k\langle\overline 0,\overline 0\rangle" /> reduces to
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.k}</td>
                <td>
                  <Outcome term={r.term} pairs compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="lam-kv">
        <dt>
          <Tex tex={`\\mathrm{Pred}\\,\\overline{${n}}`} />
        </dt>
        <dd>
          <Outcome term={pred} expect={Math.max(0, n - 1)} />
        </dd>
      </dl>
      <SendToLab src={`Fst (Pair m n)`}>Watch Fst ⟨M, N⟩ ↠ M in the Lambda Lab ↓</SendToLab>
    </Panel>
  );
}

// ------------------------------------------------------------------ truth values

/** Truth tables of Not and And, and IsZero on a few numerals, computed from the book's terms. */
export function TruthPanel() {
  const bools = [true, false];
  const T = (b: boolean) => churchBoolean(b);
  const not = useMemo(() => combinator('Not'), []);
  const and = useMemo(() => combinator('And'), []);
  const isZero = useMemo(() => combinator('IsZero'), []);
  return (
    <Panel n="⊤" title="Truth values and relations" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="\mathrm{true} \equiv \lambda x.\lambda y.\,x" /> and <Tex tex="\mathrm{false} \equiv \lambda x.\lambda y.\,y" /> select one of two arguments. (Note that <Tex tex="\mathrm{false}" /> and <Tex tex="\overline 0 \equiv \lambda f x.\,x" /> are the same term up to α-equivalence.)
      </p>
      <div className="lam-table-wrap">
        <table className="lam-table">
          <thead>
            <tr>
              <th scope="col">x</th>
              <th scope="col">
                <Tex tex="\mathrm{Not}\,x" />
              </th>
              {bools.map((y) => (
                <th scope="col" key={String(y)}>
                  <Tex tex={`\\mathrm{And}\\,x\\,\\mathrm{${y}}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bools.map((x) => (
              <tr key={String(x)}>
                <th scope="row">
                  <Tex tex={`\\mathrm{${x}}`} />
                </th>
                <td>
                  <Outcome term={app(not, T(x))} expect={!x} compact />
                </td>
                {bools.map((y) => (
                  <td key={String(y)}>
                    <Outcome term={apps(and, T(x), T(y))} expect={x && y} compact />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lam-table-wrap">
        <table className="lam-table">
          <thead>
            <tr>
              <th scope="col">n</th>
              {[0, 1, 2, 3].map((n) => (
                <th scope="col" key={n}>
                  <Tex tex={`\\mathrm{IsZero}\\,\\overline{${n}}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <Tex tex="\twoheadrightarrow" />
              </th>
              {[0, 1, 2, 3].map((n) => (
                <td key={n}>
                  <Outcome term={app(isZero, churchNumeral(n))} expect={n === 0} compact />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        With other arguments than truth values the results need not be truth values: <SendToLab src="And 2 3">try And 2̄ 3̄ in the Lambda Lab ↓</SendToLab>
      </p>
    </Panel>
  );
}


/** F applied to numerals, for each row of inputs, reduced and compared with the expected values. */
export function ValuesTable({ f, rows, expect, fuel = 20_000, header }: { f: Term; rows: number[][]; expect?: (ns: number[]) => number | boolean | undefined; fuel?: number; header?: ReactNode }) {
  return (
    <div className="lam-table-wrap">
      <table className="lam-table">
        <thead>
          <tr>
            <th scope="col">input</th>
            <th scope="col">{header ?? 'normal form (normal order)'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ns) => (
            <ValueRow key={ns.join(',')} f={f} ns={ns} expect={expect?.(ns)} fuel={fuel} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueRow({ f, ns, expect, fuel }: { f: Term; ns: number[]; expect?: number | boolean; fuel: number }) {
  const t = useMemo(() => ns.reduce<Term>((acc, n) => app(acc, churchNumeral(n)), f), [f, ns]);
  return (
    <tr>
      <td>
        <Tex tex={ns.map((n) => `\\overline{${n}}`).join('\\ ')} />
      </td>
      <td>
        <Outcome term={t} expect={expect} fuel={fuel} compact />
      </td>
    </tr>
  );
}
