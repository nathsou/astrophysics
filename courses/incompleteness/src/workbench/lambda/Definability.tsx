// The constructions of sections "Primitive Recursive Functions are λ-Definable", "Minimization",
// "Partial Recursive Functions are λ-Definable" and "λ-Definable Functions are Recursive", built by
// the engine for small functions and run on small inputs.

import { useMemo, useState, type ReactNode } from 'react';
import {
  BOOK_DEFS,
  app,
  churchNumeral,
  combinator,
  composition,
  minimization,
  numeralValue,
  parseLambda,
  primitiveRecursion,
  projection,
  print,
  type Term,
} from '../../engine/lambda/lambda';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { Outcome, ValuesTable } from './ChurchPanels';
import { useReduction, statusText } from './run';
import { LABELS, ParseError, SendToLab, TermTex, clampInt, useParsedLambda } from './shared';
import './lambda.css';

const P = (s: string) => parseLambda(s);

function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: [T, ReactNode][]; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} aria-pressed={value === k} className="chip-btn" onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ primitive recursive functions

interface CompPreset {
  label: string;
  tex: string;
  build: () => Term;
  rows: number[][];
  f: (ns: number[]) => number;
}

const COMP: CompPreset[] = [
  { label: 'Succ(Add(x, y))', tex: 'h(x, y) = \\mathrm{succ}(\\mathrm{add}(x, y))', build: () => composition(combinator('Succ'), [combinator('Add')], 2), rows: [[0, 0], [1, 2], [3, 3]], f: ([x, y]) => x! + y! + 1 },
  { label: 'Mult(P¹₀, P¹₀): x·x', tex: 'h(x) = \\mathrm{mult}(P^1_0(x), P^1_0(x)) = x\\cdot x', build: () => composition(combinator('Mult'), [projection(1, 0), projection(1, 0)], 1), rows: [[0], [2], [4]], f: ([x]) => x! * x! },
  { label: 'Mult(Add, P²₀): (x+y)·x', tex: 'h(x, y) = \\mathrm{mult}(\\mathrm{add}(x, y), P^2_0(x, y))', build: () => composition(combinator('Mult'), [combinator('Add'), projection(2, 0)], 2), rows: [[1, 1], [2, 1], [3, 0]], f: ([x, y]) => (x! + y!) * x! },
];

interface RecPreset {
  label: string;
  tex: string;
  F: string;
  G: string;
  rows: number[][];
  f: (ns: number[]) => number;
}

const REC: RecPreset[] = [
  { label: 'addition', tex: 'h(x, 0) = x,\\quad h(x, y+1) = h(x, y) + 1', F: 'λx. x', G: 'λx y z. Succ z', rows: [[2, 0], [2, 3], [4, 4]], f: ([x, y]) => x! + y! },
  { label: 'multiplication', tex: 'h(x, 0) = 0,\\quad h(x, y+1) = h(x, y) + x', F: 'Zero', G: 'λx y z. Add z x', rows: [[3, 0], [2, 3], [3, 3]], f: ([x, y]) => x! * y! },
  { label: 'exponentiation', tex: 'h(x, 0) = 1,\\quad h(x, y+1) = h(x, y)\\cdot x', F: 'λx. 1', G: 'λx y z. Mult z x', rows: [[2, 0], [2, 3], [3, 2]], f: ([x, y]) => x! ** y! },
  { label: 'truncated subtraction', tex: 'h(x, 0) = x,\\quad h(x, y+1) = h(x, y) \\mathbin{\\dot-} 1', F: 'λx. x', G: 'λx y z. Pred z', rows: [[3, 1], [2, 3], [5, 2]], f: ([x, y]) => Math.max(0, x! - y!) },
];

/** Basic functions, composition and primitive recursion, as λ-terms built as in the book's proofs. */
export function PrfPanel() {
  const [tab, setTab] = useState<'basic' | 'comp' | 'rec'>('rec');
  return (
    <Panel n="PR" title="Primitive recursive functions as λ-terms" prov={<Prov kind="computed" />}>
      <Tabs
        value={tab}
        onChange={setTab}
        label="Construction"
        items={[
          ['basic', 'Basic functions'],
          ['comp', 'Composition'],
          ['rec', 'Primitive recursion'],
        ]}
      />
      {tab === 'basic' && <BasicTab />}
      {tab === 'comp' && <CompTab />}
      {tab === 'rec' && <RecTab />}
      <NotAProof>Each row checks one input. The lemmas prove that the construction works for every input, by induction.</NotAProof>
    </Panel>
  );
}

function BasicTab() {
  const [n, setN] = useState(3);
  const [i, setI] = useState(1);
  const ii = Math.min(i, n - 1);
  const proj = useMemo(() => projection(n, ii), [n, ii]);
  const zero = useMemo(() => combinator('Zero'), []);
  const succ = useMemo(() => combinator('Succ'), []);
  const args = [4, 7, 2, 5].slice(0, n);
  return (
    <>
      <dl className="lam-kv">
        <dt>
          <Tex tex="\mathrm{Zero}" />
        </dt>
        <dd>
          <TermTex term={zero} opts={{}} />
        </dd>
        <dt>
          <Tex tex="\mathrm{Succ}" />
        </dt>
        <dd>
          <TermTex term={succ} opts={{}} />
        </dd>
        <dt>
          <Tex tex={`\\mathrm{Proj}^{${n}}_{${ii}}`} />
        </dt>
        <dd>
          <TermTex term={proj} opts={{}} />
        </dd>
      </dl>
      <div className="lam-row">
        <label>
          n =
          <input className="lam-num-input" type="number" min={1} max={4} value={n} onChange={(e) => setN(clampInt(e.target.value, 1, 4, 3))} />
        </label>
        <label>
          i =
          <input className="lam-num-input" type="number" min={0} max={n - 1} value={ii} onChange={(e) => setI(clampInt(e.target.value, 0, 3, 0))} />
        </label>
      </div>
      <ValuesTable f={proj} rows={[args]} expect={(ns) => ns[ii]} />
      <ValuesTable f={zero} rows={[[0], [5]]} expect={() => 0} header={<>Zero applied (normal order)</>} />
      <ValuesTable f={succ} rows={[[0], [5]]} expect={([x]) => x! + 1} header={<>Succ applied (normal order)</>} />
    </>
  );
}

function CompTab() {
  const [k, setK] = useState(0);
  const p = COMP[k]!;
  const h = useMemo(() => p.build(), [p]);
  return (
    <>
      <select className="lam-select" value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Example">
        {COMP.map((c, i) => (
          <option key={i} value={i}>
            {c.label}
          </option>
        ))}
      </select>
      <p>
        <Tex tex={p.tex} />
      </p>
      <p className="wb-note">
        <Tex tex="H \equiv \lambda x_0 \ldots x_{n-1}.\, F\,(G_0\, x_0 \ldots x_{n-1}) \ldots (G_{k-1}\, x_0\ldots x_{n-1})" />, built by the engine:
      </p>
      <TermTex term={h} opts={LABELS} />
      <ValuesTable f={h} rows={p.rows} expect={p.f} />
    </>
  );
}

function RecTab() {
  const [k, setK] = useState(0);
  const p = REC[k]!;
  const h = useMemo(() => primitiveRecursion(P(p.F), P(p.G)), [p]);
  return (
    <>
      <select className="lam-select" value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Example">
        {REC.map((c, i) => (
          <option key={i} value={i}>
            {c.label}
          </option>
        ))}
      </select>
      <p>
        <Tex tex={p.tex} />
      </p>
      <dl className="lam-kv">
        <dt>F</dt>
        <dd>
          <TermTex term={P(p.F)} opts={LABELS} />
        </dd>
        <dt>G</dt>
        <dd>
          <TermTex term={P(p.G)} opts={LABELS} />
        </dd>
        <dt>H</dt>
        <dd>
          <TermTex term={h} opts={LABELS} />
        </dd>
      </dl>
      <p className="wb-note">
        <Tex tex="H \equiv \lambda x.\lambda y.\,\mathrm{Snd}(y\,D\,\langle\overline 0, F x\rangle)" /> with <Tex tex="D \equiv \lambda p.\langle \mathrm{Succ}(\mathrm{Fst}\,p), G\,x\,(\mathrm{Fst}\,p)(\mathrm{Snd}\,p)\rangle" />: the pairs are written out as <Tex tex="\lambda f.\,f\,M\,N" />. The numeral <i>y</i> iterates <i>D</i> from <Tex tex="\langle \overline 0, F x\rangle" />.
      </p>
      <ValuesTable f={h} rows={p.rows} expect={p.f} />
      <SendToLab src={`(${print(h)}) ${p.rows[1]!.join(' ')}`} />
    </>
  );
}

// ------------------------------------------------------------------ minimization

interface MinPreset {
  label: string;
  tex: string;
  F: string;
  f: (x: number) => number;
}

const MIN: MinPreset[] = [
  { label: 'μy [x ∸ y = 0] = x', tex: 'f(x, y) = x \\mathbin{\\dot-} y,\\quad h(x) = \\mu y\\,[x \\mathbin{\\dot-} y = 0] = x', F: 'Sub', f: (x) => x },
  { label: 'μy [x ∸ 2y = 0] = ⌈x/2⌉', tex: 'f(x, y) = x \\mathbin{\\dot-} (y + y),\\quad h(x) = \\lceil x/2 \\rceil', F: 'λx y. Sub x (Add y y)', f: (x) => Math.ceil(x / 2) },
  { label: 'μy [x ∸ y² = 0] = ⌈√x⌉', tex: 'f(x, y) = x \\mathbin{\\dot-} y\\cdot y,\\quad h(x) = \\lceil \\sqrt x\\, \\rceil', F: 'λx y. Sub x (Mult y y)', f: (x) => Math.ceil(Math.sqrt(x)) },
];

/** H ≡ λx.(Y Search) F x 0̄ for a few regular F. */
export function MinPanel() {
  const [k, setK] = useState(0);
  const p = MIN[k]!;
  const h = useMemo(() => minimization(P(p.F), 1), [p]);
  const search = useMemo(() => P(BOOK_DEFS.Search!.src as string), []);
  return (
    <Panel n="μ" title="Minimization with a fixpoint combinator" prov={<Prov kind="computed" />}>
      <select className="lam-select" value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Example">
        {MIN.map((c, i) => (
          <option key={i} value={i}>
            {c.label}
          </option>
        ))}
      </select>
      <p>
        <Tex tex={p.tex} />
      </p>
      <dl className="lam-kv">
        <dt>Search</dt>
        <dd>
          <TermTex term={search} opts={LABELS} />
        </dd>
        <dt>F</dt>
        <dd>
          <TermTex term={P(p.F)} opts={LABELS} />
        </dd>
        <dt>H</dt>
        <dd>
          <TermTex term={h} opts={LABELS} />
        </dd>
      </dl>
      <ValuesTable f={h} rows={[[0], [1], [2], [3], [4]]} expect={([x]) => p.f(x!)} fuel={30_000} />
      <NotAProof>The rows check five inputs. The lemma shows H λ-defines h for every input, using that f is regular.</NotAProof>
    </Panel>
  );
}

// ------------------------------------------------------------------ partial functions

/** Unbounded search for a non-regular f, and the composition problem the book describes. */
export function PartialPanel() {
  const partialH = useMemo(() => minimization(P('λx y. Add (Sub x 2) (Sub 2 y)'), 1), []);
  const neverH = useMemo(() => minimization(P('λx y. Succ y'), 1), []);
  const G = useMemo(() => P('λx. Ω'), []);
  const Fk = useMemo(() => P('λx. λy. y'), []);
  const g2 = useMemo(() => app(G, churchNumeral(2)), [G]);
  const fg2 = useMemo(() => app(Fk, app(G, churchNumeral(2))), [Fk, G]);
  return (
    <>
      <Panel n="1" title="Search without regularity" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          <Tex tex="f(x, y) = (x \mathbin{\dot-} 2) + (2 \mathbin{\dot-} y)" /> has a zero in <i>y</i> exactly when <Tex tex="x \le 2" />. So <Tex tex="g(x) = \mu y\,[f(x, y) = 0]" /> is 2 for <Tex tex="x \le 2" /> and undefined otherwise. The same term H as for regular functions:
        </p>
        <ValuesTable f={partialH} rows={[[0], [2], [3], [4]]} expect={([x]) => (x! <= 2 ? 2 : undefined)} fuel={4000} />
        <p className="wb-note">
          For <i>x</i> = 3 and 4 the search never succeeds; the table can only report that no normal form appeared within the step limit. For <Tex tex="f(x, y) = y + 1" />, which is never 0:
        </p>
        <ValuesTable f={neverH} rows={[[0]]} fuel={1500} />
      </Panel>
      <Panel n="2" title="Why composition needs care" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          The book’s example: let <Tex tex="F \equiv \lambda x.\lambda y.\,y" /> and let <i>G</i> define a function <i>g</i> that is nowhere defined, say <Tex tex="G \equiv \lambda x.\,\Omega" /> with <Tex tex="\Omega \equiv (\lambda x.xx)(\lambda x.xx)" />.
        </p>
        <dl className="lam-kv">
          <dt>
            <Tex tex="G\,\overline 2" />
          </dt>
          <dd>
            <Outcome term={g2} fuel={200} />
          </dd>
          <dt>
            <Tex tex="F\,(G\,\overline 2)" />
          </dt>
          <dd>
            <Outcome term={fg2} fuel={200} raw />
          </dd>
        </dl>
        <p className="wb-note">
          <Tex tex="F(G\,\overline 2)" /> reaches the normal form <Tex tex="\lambda y.\,y" /> although <Tex tex="g(2)" /> is undefined: normal order never evaluates the argument that <i>F</i> discards. (That <Tex tex="G\,\overline 2" /> has no normal form at all is not shown by running it; it holds because <Tex tex="\Omega" /> reduces only to itself.)
        </p>
        <SendToLab src="(λx. λy. y) ((λx. Ω) 2)" />
      </Panel>
    </>
  );
}

// ------------------------------------------------------------------ the proof sketch of λ-definable ⇒ recursive

/** toChurch, F, normalize, fromChurch — the pipeline in the proof sketch, run directly on terms. */
export function PipelinePanel() {
  const [src, setSrc] = useState('λn. Mult n n');
  const [n, setN] = useState(3);
  const parsed = useParsedLambda(src);
  const num = useMemo(() => churchNumeral(n), [n]);
  const applied = useMemo(() => (parsed.ok ? app(parsed.value, churchNumeral(n)) : null), [parsed, n]);
  const st = useReduction(applied, 20_000);
  return (
    <Panel n="→" title="toChurch, normalize, fromChurch" prov={<Prov kind="computed" />}>
      <label className="fi-label" htmlFor="lam-pipe-f">
        F (a term with one argument)
      </label>
      <input id="lam-pipe-f" className={`lam-field ${parsed.ok ? '' : 'invalid'}`} value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} autoCapitalize="off" />
      <ParseError src={src} r={parsed} />
      <div className="lam-row">
        <label>
          n =
          <input className="lam-num-input" type="number" min={0} max={8} value={n} onChange={(e) => setN(clampInt(e.target.value, 0, 8, 0))} />
        </label>
        {['λn. Mult n n', 'Fac', 'Pred', 'λn. IsZero n 1 Ω'].map((s) => (
          <button key={s} type="button" className="chip-btn" onClick={() => setSrc(s)}>
            {s}
          </button>
        ))}
      </div>
      <ol className="lam-trace">
        <li>
          <b>toChurch({n})</b> = <TermTex term={num} />
        </li>
        {applied && (
          <li>
            <b>the term</b> <TermTex term={applied} opts={LABELS} />
          </li>
        )}
        <li>
          <b>normalize</b>:{' '}
          {!st || st.phase === 'running' ? (
            <span className="lam-steps-inline">reducing… {st?.phase === 'running' ? st.count : 0} steps</span>
          ) : st.status === 'normal-form' ? (
            <>
              <TermTex term={st.final} /> <span className="lam-steps-inline">after {st.count} normal-order steps</span>
            </>
          ) : (
            <span>{statusText(st.status, st.count)} The function normalize of the proof is undefined exactly when there is no normal form; a bounded run can only fail to find one.</span>
          )}
        </li>
        {st?.phase === 'done' && st.status === 'normal-form' && (
          <li>
            <b>fromChurch</b>: {numeralValue(st.final) !== null ? <Tex tex={`${numeralValue(st.final)}`} /> : 'the normal form is not a Church numeral, so fromChurch is undefined here'}
          </li>
        )}
      </ol>
      <p className="wb-note">
        The proof works with Gödel numbers of terms; this panel runs the same procedure on the terms themselves. Normal order is used because it finds a normal form whenever there is one.
      </p>
    </Panel>
  );
}
