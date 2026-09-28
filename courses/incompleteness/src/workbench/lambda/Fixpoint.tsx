// Section "Fixpoints": Y g ↠ g(Y g) step by step, Church's Y_C, the factorial Fac ≡ Y Fac′ under
// normal and applicative order, and recursive definitions of the reader's own.

import { useMemo, useState } from 'react';
import { alphaEq, app, churchNumeral, combinator, parseLambda, reduce, variable, type KnownTerm, type LambdaPrintOptions, type Term } from '../../engine/lambda/lambda';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { Outcome } from './ChurchPanels';
import { useReduction, statusText } from './run';
import { LABELS, ParseError, SendToLab, TermTex, clampInt, useParsedLambda } from './shared';
import './lambda.css';

const P = (s: string) => parseLambda(s);

export function Trace({ start, steps, opts }: { start: Term; steps: number; opts: LambdaPrintOptions }) {
  const run = useMemo(() => reduce(start, 'normal', { fuel: steps }), [start, steps]);
  return (
    <ol className="lam-trace" start={0}>
      <li>
        <TermTex term={start} opts={opts} />
      </li>
      {run.steps.map((c, i) => (
        <li key={i}>
          <Tex tex="\to_\beta" /> <TermTex term={c.result} opts={opts} />
        </li>
      ))}
    </ol>
  );
}

/** Y g ↠ g (Y g) ↠ g (g (Y g)) …, and Church's Y_C. */
export function YPanel() {
  const [steps, setSteps] = useState(2);
  const y = useMemo(() => combinator('Y'), []);
  const u = useMemo(() => combinator('U'), []);
  const yg = useMemo(() => app(y, variable('g')), [y]);
  const known: KnownTerm[] = useMemo(() => [{ label: 'Y', term: y }, { label: 'U', term: u }], [y, u]);
  const opts: LambdaPrintOptions = useMemo(() => ({ labels: true, known }), [known]);
  const two = useMemo(() => reduce(yg, 'normal', { fuel: 2 }).final, [yg]);
  const ok = alphaEq(two, app(variable('g'), app(combinator('Y'), variable('g'))));
  // Church's Y_C
  const yc = useMemo(() => combinator('Y_C'), []);
  const v = useMemo(() => P('λx. g (x x)'), []);
  const optsC: LambdaPrintOptions = useMemo(() => ({ labels: true, known: [{ label: 'V', term: v }] }), [v]);
  const ycg = useMemo(() => app(yc, variable('g')), [yc]);
  const gycg = useMemo(() => app(variable('g'), app(combinator('Y_C'), variable('g'))), []);
  const a = useMemo(() => reduce(ycg, 'normal', { fuel: 2 }).final, [ycg]);
  const b = useMemo(() => reduce(gycg, 'normal', { fuel: 1 }).final, [gycg]);
  return (
    <Panel n="Y" title="Fixpoint combinators" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="Y \equiv U U" /> with <Tex tex="U \equiv \lambda u x.\, x(uux)" />. Normal order on <Tex tex="Y g" />, with copies of <i>U</i> and <i>Y</i> shown by name:
      </p>
      <div className="lam-row">
        <label>
          steps
          <input className="lam-num-input" type="number" min={1} max={10} value={steps} onChange={(e) => setSteps(clampInt(e.target.value, 1, 10, 2))} />
        </label>
      </div>
      <Trace start={yg} steps={steps} opts={opts} />
      <p className="wb-note" aria-live="polite">
        After two steps the term is {ok ? <b style={{ color: 'var(--checked)' }}>identical (up to α) to g (Y g)</b> : 'not g (Y g)'}. The reduction never ends: every second step adds another <i>g</i>.
      </p>
      <p className="wb-note">
        Church’s <Tex tex="Y_C \equiv \lambda g.\,VV" /> with <Tex tex="V \equiv \lambda x.\, g(xx)" /> behaves differently: <Tex tex="Y_C\, g" /> and <Tex tex="g(Y_C\, g)" /> reduce to a common term, but the first does not reduce to the second.
      </p>
      <dl className="lam-kv">
        <dt>
          <Tex tex="Y_C\,g \twoheadrightarrow" />
        </dt>
        <dd>
          <TermTex term={a} opts={optsC} />
        </dd>
        <dt>
          <Tex tex="g(Y_C\,g) \twoheadrightarrow" />
        </dt>
        <dd>
          <TermTex term={b} opts={optsC} />
        </dd>
      </dl>
      <p className="wb-note">{alphaEq(a, b) ? 'The two results are the same term, g(VV): so Y_C g =β g(Y_C g).' : ''}</p>
      <SendToLab src="Y g" />
    </Panel>
  );
}

const FACT = [1, 1, 2, 6, 24];

/** Fac n̄ under normal order (a numeral) and under applicative order (Y unfolds forever). */
export function FacPanel() {
  const [n, setN] = useState(3);
  const fac = useMemo(() => app(combinator('Fac'), churchNumeral(n)), [n]);
  const facC = useMemo(() => P(`Y_C Fac' ${n}`), [n]);
  const appl = useReduction(fac, 2000, 'applicative');
  return (
    <Panel n="!" title="The factorial Fac ≡ Y Fac′" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="\mathrm{Fac}' \equiv \lambda g.\lambda n.\,\mathrm{IsZero}\,n\,\overline 1\,(\mathrm{Mult}\,n\,(g(\mathrm{Pred}\,n)))" />
      </p>
      <div className="lam-row">
        <label>
          n =
          <input className="lam-num-input" type="number" min={0} max={4} value={n} onChange={(e) => setN(clampInt(e.target.value, 0, 4, 3))} />
        </label>
        <span className="lam-steps-inline">(at most 4: the number of steps grows fast)</span>
      </div>
      <dl className="lam-kv">
        <dt>
          <Tex tex={`\\mathrm{Fac}\\,\\overline{${n}}`} />, normal order
        </dt>
        <dd>
          <Outcome term={fac} expect={FACT[n]} fuel={20_000} />
        </dd>
        <dt>
          <Tex tex={`Y_C\\,\\mathrm{Fac}'\\,\\overline{${n}}`} />, normal order
        </dt>
        <dd>
          <Outcome term={facC} expect={FACT[n]} fuel={20_000} />
        </dd>
        <dt>
          <Tex tex={`\\mathrm{Fac}\\,\\overline{${n}}`} />, applicative order
        </dt>
        <dd>{!appl || appl.phase === 'running' ? <span className="lam-steps-inline">reducing…</span> : <span>{statusText(appl.status, appl.count, 'applicative order')}</span>}</dd>
      </dl>
      <p className="wb-note">
        Applicative order reduces the argument <Tex tex="Y\,\mathrm{Fac}'" /> before using it, and that argument only ever unfolds to <Tex tex="\mathrm{Fac}'(Y\,\mathrm{Fac}')" />, <Tex tex="\mathrm{Fac}'(\mathrm{Fac}'(Y\,\mathrm{Fac}'))" />, … Normal order passes it unevaluated, and <Tex tex="\mathrm{IsZero}" /> throws it away once <i>n</i> reaches 0.
      </p>
      <SendToLab src={`Fac ${Math.min(n, 1)}`}>Step through Fac {Math.min(n, 1)}̄ in the Lambda Lab ↓</SendToLab>
      <NotAProof>These runs compute particular values. That Fac λ-defines the factorial for every n is shown in the text.</NotAProof>
    </Panel>
  );
}

const RECS: { label: string; src: string }[] = [
  { label: 'factorial', src: "Fac'" },
  { label: 'sum 0 + 1 + … + n', src: 'λg n. IsZero n 0 (Add n (g (Pred n)))' },
  { label: 'is n even?', src: 'λg n. IsZero n True (Not (g (Pred n)))' },
  { label: 'Fibonacci', src: 'λg n. IsZero n 0 (IsZero (Pred n) 1 (Add (g (Pred n)) (g (Pred (Pred n)))))' },
  { label: 'no base case', src: 'λg n. Succ (g n)' },
];

/** G ≡ Y (λg.λx.N) for a recursive equation of the reader's own. */
export function RecursionPanel() {
  const [src, setSrc] = useState(RECS[1]!.src);
  const [n, setN] = useState(3);
  const parsed = useParsedLambda(src);
  const term = useMemo(() => (parsed.ok ? app(app(combinator('Y'), parsed.value), churchNumeral(n)) : null), [parsed, n]);
  return (
    <Panel n="g" title="Your own recursive definition" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Write the recursive equation <Tex tex="g\,x = N" /> as the term <Tex tex="\lambda g.\lambda x.\,N" />; then <Tex tex="G \equiv Y\,(\lambda g.\lambda x.\,N)" /> satisfies it.
      </p>
      <label className="fi-label" htmlFor="lam-rec-in">
        λg.λx.N
      </label>
      <input id="lam-rec-in" className={`lam-field ${parsed.ok ? '' : 'invalid'}`} value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} autoCapitalize="off" />
      <ParseError src={src} r={parsed} />
      <div className="lam-row">
        {RECS.map((r) => (
          <button key={r.label} type="button" className="chip-btn" aria-pressed={src === r.src} onClick={() => setSrc(r.src)}>
            {r.label}
          </button>
        ))}
        <label>
          n =
          <input className="lam-num-input" type="number" min={0} max={6} value={n} onChange={(e) => setN(clampInt(e.target.value, 0, 6, 3))} />
        </label>
      </div>
      {term && (
        <dl className="lam-kv">
          <dt>term</dt>
          <dd>
            <TermTex term={term} opts={LABELS} />
          </dd>
          <dt>normal order</dt>
          <dd>
            <Outcome term={term} fuel={30_000} />
          </dd>
        </dl>
      )}
    </Panel>
  );
}
