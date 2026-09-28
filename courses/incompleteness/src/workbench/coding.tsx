// Views of the coding of an expression: its official symbol string, the symbol codes, the
// Gödel number, and decoding. Shared by the workbenches of Coding Symbols/Terms/Formulas.

import { useMemo, useState, type ReactNode } from 'react';
import type { Analysis } from '../engine/syntax/analysis';
import type { CodeItem, Encoding } from '../engine/coding/godel';
import { decode } from '../engine/coding/godel';
import { describeSym, officialTex, symbolCode, symbolCodeSeq, symTex, type Sym } from '../engine/syntax/language';
import { nthPrime } from '../engine/numbers/primes';
import { formatMagnitude, lit, magnitude, seqOf, show, toTex, type Nat } from '../engine/numbers/nat';
import type { Node } from '../engine/syntax/ast';
import { Tex } from '../ui/Tex';
import { FormulaView, highlightNode, clearHighlight } from '../ui/FormulaView';
import { NatView } from '../ui/NatView';
import { Stepper } from '../ui/Stepper';
import { Prov } from '../ui/Prov';
import { highlightStore, inspect } from '../ui/store';

export function codeSeqTex(s: Sym): string {
  return `\\langle ${symbolCodeSeq(s).join(', ')} \\rangle`;
}

/** 2^{a+1} · 3^{b+1} · … for a symbol code sequence. */
export function codePowersTex(s: Sym): string {
  return symbolCodeSeq(s)
    .map((a, i) => `${nthPrime(i)}^{${a + 1}}`)
    .join(' \\cdot ');
}

/** Concrete positions of the items (null after a symbolic run). */
export function positions(items: CodeItem[]): (number | null)[] {
  let p: number | null = 0;
  return items.map((it) => {
    const here = p;
    if (p !== null) {
      if (it.k === 'sym') p += 1;
      else p = null;
    }
    return here;
  });
}

export function symbolEntry(it: Extract<CodeItem, { k: 'sym' }>, pos: number | null) {
  const code = symbolCode(it.sym);
  return {
    key: `sym:${it.node}:${pos}`,
    kicker: pos !== null ? `Symbol at position ${pos}` : 'Symbol',
    title: <Tex tex={symTex(it.sym)} />,
    body: (
      <>
        <p>
          {capital(describeSym(it.sym))}. Officially <Tex tex={officialTex(it.sym)} />.
        </p>
        {it.role === 'binder-var' && <p className="muted">It follows a quantifier, so it is not an occurrence that substitution could replace.</p>}
        {it.role === 'numeral-tick' && <p className="muted">Part of a numeral, which is written out as ′(′(…0…)).</p>}
        {(it.role === 'open' || it.role === 'close' || it.role === 'comma') && <p className="muted">Punctuation of the official notation, which is prefix notation with parentheses and commas.</p>}
        <dl>
          <dt>code</dt>
          <dd>
            <Tex tex={`\\mathrm{c}_{${symTex(it.sym)}} = ${codeSeqTex(it.sym)} = ${codePowersTex(it.sym)} = ${code}`} />
          </dd>
          {pos !== null && (
            <>
              <dt>in the Gödel number</dt>
              <dd>
                <Tex tex={`p_{${pos}}^{c + 1} = ${nthPrime(pos)}^{${code + 1n}}`} />
              </dd>
            </>
          )}
        </dl>
      </>
    ),
  };
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The official symbol string as chips. */
export function SymbolStrip({ enc, analysis, activePos }: { enc: Encoding; analysis: Analysis; activePos?: number | null }) {
  const pos = positions(enc.items);
  return (
    <div className="symbol-strip" role="list" aria-label="Official symbols" onMouseLeave={clearHighlight}>
      {enc.items.map((it, i) => (
        <ItemChip key={i} it={it} pos={pos[i]} analysis={analysis} active={activePos !== undefined && activePos === pos[i]} />
      ))}
    </div>
  );
}

function ItemChip({ it, pos, analysis, active }: { it: CodeItem; pos: number | null; analysis: Analysis; active: boolean }) {
  const hover = () => {
    highlightNode(analysis, it.node);
    if (it.k === 'sym') inspect(symbolEntry(it, pos));
    else if (it.k === 'numeral') inspect(numeralRunEntry(it.value));
    else inspect({ key: `abbr:${it.node}`, kicker: 'Named formula', title: <Tex tex={toTex(it.code)} />, body: <p>The symbols of this named formula are not written out; their codes enter the Gödel number as a block, known by name.</p> });
  };
  if (it.k === 'sym') {
    return (
      <span role="listitem" className={`chip sym-chip role-${it.role} ${active ? 'active' : ''}`} data-n={it.node} onMouseEnter={hover} onFocus={hover} tabIndex={0} onClick={() => it.k === 'sym' && inspect(symbolEntry(it, pos), true)}>
        <span className="chip-sym">
          <Tex tex={symTex(it.sym)} />
        </span>
        <span className="chip-pos">{pos ?? '·'}</span>
      </span>
    );
  }
  if (it.k === 'numeral') {
    return (
      <span role="listitem" className="chip run-chip" data-n={it.node} onMouseEnter={hover} onFocus={hover} tabIndex={0}>
        <span className="chip-sym">
          <Tex tex={`(\\prime\\,(\\,)^{\\times ${toTex(it.value, { maxItems: 3, maxDigits: 8 })}}\\; 0\\; (\\,)\\,)^{\\times ${toTex(it.value, { maxItems: 3, maxDigits: 8 })}}`} />
        </span>
        <span className="chip-pos">numeral</span>
      </span>
    );
  }
  return (
    <span role="listitem" className="chip abbr-chip" data-n={it.node} onMouseEnter={hover} onFocus={hover} tabIndex={0}>
      <span className="chip-sym">
        <Tex tex={`${it.formula.k === 'abbr' ? it.formula.tex : ''}(\\ldots)`} />
      </span>
      <span className="chip-pos">named</span>
    </span>
  );
}

export function numeralRunEntry(value: Nat) {
  return {
    key: `run:${show(value).slice(0, 40)}`,
    kicker: 'A numeral, written out',
    title: <Tex tex={`\\overline{n} = {}'({}'(\\cdots {}'(0)\\cdots))`} />,
    body: (
      <>
        <p>
          The numeral for <Tex tex={`n = ${toTex(value, { maxItems: 4, maxDigits: 12 })}`} /> is officially the symbol string
          <Tex tex="\;{}'\,(\;{}'\,(\;\cdots\;0\;)\;\cdots\;)" /> with <Tex tex="n" /> copies of <Tex tex="{}'(" />. Its Gödel number is
        </p>
        <p>
          <Tex tex={`\\mathrm{num}(n) = \\langle \\underbrace{\\mathrm{c}_{'}, \\mathrm{c}_{(}, \\ldots, \\mathrm{c}_{'}, \\mathrm{c}_{(}}_{2n}, \\mathrm{c}_{0}, \\underbrace{\\mathrm{c}_{)}, \\ldots, \\mathrm{c}_{)}}_{n} \\rangle`} />
        </p>
        <p className="muted">
          It is kept as a repeated block because <Tex tex="n" /> has {formatMagnitude(magnitude(value, { lowerBound: true }))}; nobody could write the numeral out.
        </p>
      </>
    ),
  };
}

/** The table of symbol codes, one row per symbol. */
export function CodeTable({ enc, analysis, activePos, limit = 60 }: { enc: Encoding; analysis: Analysis; activePos?: number | null; limit?: number }) {
  const pos = positions(enc.items);
  const [all, setAll] = useState(false);
  const rows = all ? enc.items : enc.items.slice(0, limit);
  return (
    <div className="code-table-wrap" onMouseLeave={clearHighlight}>
      <table className="code-table">
        <thead>
          <tr>
            <th scope="col">i</th>
            <th scope="col">symbol</th>
            <th scope="col">code sequence</th>
            <th scope="col">
              code <Tex tex="\mathrm{c}_s" />
            </th>
            <th scope="col">
              factor <Tex tex="p_i^{\mathrm{c}_s+1}" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => {
            const p = pos[i];
            const hover = () => {
              highlightNode(analysis, it.node);
              if (it.k === 'sym') inspect(symbolEntry(it, p));
              else if (it.k === 'numeral') inspect(numeralRunEntry(it.value));
            };
            if (it.k !== 'sym') {
              return (
                <tr key={i} data-n={it.node} onMouseEnter={hover} className="run-row">
                  <td>{p ?? '…'}</td>
                  <td colSpan={4} className="muted">
                    {it.k === 'numeral' ? (
                      <>
                        numeral: <Tex tex={`\\mathrm{c}_{'}, \\mathrm{c}_{(}`} /> repeated <Tex tex={toTex(it.value, { maxItems: 3, maxDigits: 10 })} /> times, then <Tex tex="\mathrm{c}_{0}" />, then <Tex tex="\mathrm{c}_{)}" /> repeated as often
                      </>
                    ) : (
                      <>
                        named formula: its codes, known by name, <Tex tex={toTex(it.code, { maxItems: 3 })} />
                      </>
                    )}
                  </td>
                </tr>
              );
            }
            const code = symbolCode(it.sym);
            return (
              <tr key={i} data-n={it.node} onMouseEnter={hover} onClick={() => inspect(symbolEntry(it, p), true)} className={activePos === p ? 'active' : ''}>
                <td>{p ?? '…'}</td>
                <td>
                  <Tex tex={symTex(it.sym)} />
                </td>
                <td>
                  <Tex tex={codeSeqTex(it.sym)} />
                </td>
                <td className="num">{code.toLocaleString('en-US')}</td>
                <td>{p !== null ? <Tex tex={`${nthPrime(p)}^{${code + 1n}}`} /> : '…'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!all && enc.items.length > limit && (
        <button className="chip-btn" onClick={() => setAll(true)}>
          show all {enc.items.length} rows
        </button>
      )}
    </div>
  );
}

/** The Gödel number in several exact forms. */
export function GodelNumberView({ enc }: { enc: Encoding }) {
  const [form, setForm] = useState<'seq' | 'powers'>('seq');
  const seqOfCodes = useMemo(() => enc.number, [enc]);
  return (
    <div className="godel-number">
      <div className="gn-forms" role="radiogroup" aria-label="Form">
        <button className="chip-btn" role="radio" aria-checked={form === 'seq'} onClick={() => setForm('seq')}>
          ⟨codes⟩
        </button>
        <button className="chip-btn" role="radio" aria-checked={form === 'powers'} onClick={() => setForm('powers')}>
          prime powers
        </button>
      </div>
      <NatView n={seqOfCodes} style={form} maxItems={form === 'seq' ? 12 : 7} />
    </div>
  );
}

/** Multiply in one symbol at a time. */
export function EncodeStepper({ enc, analysis }: { enc: Encoding; analysis: Analysis }) {
  const pos = positions(enc.items);
  const concrete = enc.items.filter((it, i) => it.k === 'sym' && pos[i] !== null) as Extract<CodeItem, { k: 'sym' }>[];
  const [step, setStep] = useState(0);
  const n = concrete.length;
  if (n === 0) return null;
  const s = Math.min(step, n - 1);
  const it = concrete[s];
  const partial = seqOf(concrete.slice(0, s + 1).map((x) => lit(symbolCode(x.sym))));
  const onStep = (i: number) => {
    setStep(i);
    const x = concrete[i];
    highlightStore.set({ primary: [x.node], secondary: [] });
    inspect(symbolEntry(x, i));
  };
  return (
    <div className="encode-stepper">
      <Stepper
        step={s}
        count={n}
        onStep={onStep}
        label="encode"
        describe={(i) => (
          <>
            Position {i}: the symbol <Tex tex={symTex(concrete[i].sym)} /> has code {symbolCode(concrete[i].sym).toLocaleString('en-US')}, so multiply by{' '}
            <Tex tex={`p_{${i}}^{${symbolCode(concrete[i].sym) + 1n}} = ${nthPrime(i)}^{${symbolCode(concrete[i].sym) + 1n}}`} />.
          </>
        )}
      />
      <div className="encode-partial">
        <span className="muted sans small">product so far</span>
        <Tex tex={`\\langle ${concrete.slice(0, s + 1).map((x) => symbolCode(x.sym).toString()).join(', ')} \\rangle`} />
        <span className="nat-size">{formatMagnitude(magnitude(partial))}</span>
        <span className="sr-only">current symbol {it.sym.k}</span>
      </div>
    </div>
  );
}

/** Decode a number: factor, read symbol codes, parse. */
export function Decoder({ initial, onUseNumber }: { initial?: Nat; onUseNumber?: () => Nat }) {
  const [text, setText] = useState(DECODER_EXAMPLES[0].text);
  const [target, setTarget] = useState<Nat | null>(() => initial ?? lit(parseNumberExpr(DECODER_EXAMPLES[0].text)!));
  const [error, setError] = useState<string | null>(null);
  const outcome = useMemo(() => (target ? decode(target) : null), [target]);
  const run = (s: string) => {
    setText(s);
    const v = parseNumberExpr(s);
    if (v === null) {
      setError('Write a natural number, or a product of powers like 2^3 · 3^8.');
      setTarget(null);
    } else {
      setError(null);
      setTarget(lit(v));
    }
  };
  return (
    <div className="decoder">
      <div className="decoder-input">
        <label className="fi-label" htmlFor="decode-input">
          A number to decode
        </label>
        <textarea id="decode-input" className="fi-field mono" rows={2} value={text} onChange={(e) => run(e.target.value)} spellCheck={false} />
        <div className="decoder-actions">
          <button className="chip-btn" onClick={() => run(text)}>
            Decode
          </button>
          {onUseNumber && (
            <button
              className="chip-btn"
              onClick={() => {
                setText('(the Gödel number of your formula)');
                setError(null);
                setTarget(onUseNumber());
              }}
            >
              use the Gödel number of your formula
            </button>
          )}
          {DECODER_EXAMPLES.map((ex) => (
            <button key={ex.text} className="chip-btn" onClick={() => run(ex.text)} title={ex.what}>
              {ex.text}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="fi-error">{error}</p>}
      {outcome && <DecodeTraceView outcome={outcome} />}
    </div>
  );
}

// Small examples, one for each outcome: a term, a formula, and a failure at each stage.
const DECODER_EXAMPLES = [
  { text: '2^13', what: 'the term v₀' },
  { text: '2^7', what: 'the formula ⊥' },
  { text: '2^25', what: 'the term 0' },
  { text: '2^13 · 3^13', what: 'two variables in a row: symbols, but not well formed' },
  { text: '2^3 · 3^2 · 5^4', what: 'a sequence code whose elements are not symbol codes' },
  { text: '10', what: 'not a sequence code' },
];

function DecodeTraceView({ outcome }: { outcome: ReturnType<typeof decode> }) {
  const factors = outcome.trace.filter((t) => t.k === 'factor');
  const symbols = outcome.trace.filter((t) => t.k === 'symbol');
  return (
    <div className="decode-trace">
      {factors.length > 0 && (
        <div className="dt-stage">
          <div className="dt-title">
            1 · Factor as a sequence code <Prov kind="computed" />
          </div>
          <div className="dt-factors">
            {factors.slice(0, 40).map((f, i) =>
              f.k === 'factor' ? (
                <span key={i} className={`dt-factor ${f.element === null ? 'bad' : ''}`}>
                  <Tex tex={`${f.p}^{${f.exponent}}`} />
                  <span className="muted small">{f.element === null ? 'missing!' : `→ ${f.element}`}</span>
                </span>
              ) : null,
            )}
            {factors.length > 40 && <span className="muted">… {factors.length - 40} more</span>}
          </div>
        </div>
      )}
      {symbols.length > 0 && (
        <div className="dt-stage">
          <div className="dt-title">2 · Read each element as a symbol code</div>
          <div className="dt-symbols">
            {symbols.slice(0, 80).map((s, i) =>
              s.k === 'symbol' ? (
                <span key={i} className={`dt-sym ${s.sym ? '' : 'bad'}`} title={s.error}>
                  <span className="mono small">{s.code.toString().length > 9 ? `${s.code.toString().slice(0, 6)}…` : s.code.toString()}</span>
                  <span className="muted small">{s.codeSeq.length ? `⟨${s.codeSeq.join(',')}⟩` : '—'}</span>
                  {s.sym ? <Tex tex={symTex(s.sym)} /> : <span className="bad">✗</span>}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}
      <div className="dt-stage">
        <div className="dt-title">3 · Read the symbols as {outcome.ok ? (isTermNode(outcome.node) ? 'a term' : 'a formula') : 'a term or formula'}</div>
        {outcome.ok ? (
          <p>
            <FormulaView node={outcome.node} /> <Prov kind="computed">decoded</Prov>
          </p>
        ) : (
          <p className="error-box">
            <b>{outcome.stage === 'sequence' ? 'Not a sequence code.' : outcome.stage === 'symbols' ? 'Not a string of symbols.' : 'Not well formed.'}</b> {outcome.error}
          </p>
        )}
      </div>
    </div>
  );
}

function isTermNode(n: Node) {
  return n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral';
}

/** Parses `123`, `2^3 · 3^8`, `2^3*3^8`. */
export function parseNumberExpr(s: string): bigint | null {
  const t = s.replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d+$/.test(t)) return BigInt(t);
  const factors = t.split(/[·*×]/);
  let r = 1n;
  for (const f of factors) {
    const m = /^(\d+)(?:\^\{?(\d+)\}?)?$/.exec(f);
    if (!m) return null;
    const e = BigInt(m[2] ?? '1');
    // Refuse numbers of more than about 20 million bits, so that the page never hangs.
    if (e > 5_000_000n || e * BigInt(m[1].length * 4) > 20_000_000n) return null;
    r *= BigInt(m[1]) ** e;
  }
  return r;
}

export function Panel({ n, title, children, prov, id }: { n?: number | string; title: ReactNode; children: ReactNode; prov?: ReactNode; id?: string }) {
  return (
    <section className="wb-panel" id={id}>
      <header className="wb-panel-head">
        {n !== undefined && <span className="wb-n">{n}</span>}
        <span className="wb-title">{title}</span>
        {prov}
      </header>
      <div className="wb-panel-body">{children}</div>
    </section>
  );
}
