// Functions representable in Q are computable (section "Functions Representable in Q are
// Computable"): f(n⃗) = (μs R(n⃗, s))₁ with R(n⃗, s) ⟺ Prf_Q((s)₀, A(n⃗, (s)₁)). For a chosen f and
// input, a pair s = ⟨#δ#, m⟩ satisfying R is exhibited — δ a checked derivation of A_f(n̄⃗, m̄) in
// Q, coded as in section 3.6 — and R(n⃗, s) is verified on the codes. For a wrong value m′,
// Lemma rep-q: Q refutes A_f(n̄⃗, m̄′), by a checked derivation.

import { useMemo, useState } from 'react';
import { check } from '../../engine/proof/nd';
import { Q } from '../../engine/proof/q';
import { evaluate } from '../../engine/recursive/rf';
import { deriveClauses, instance, representing } from '../../engine/represent/represent';
import { deriveNotValue } from '../../engine/represent/relations';
import { encodeDerivation, prf, component } from '../../engine/coding/derivations';
import { godelNumber } from '../../engine/coding/godel';
import { formatMagnitude, lit, magnitude, seqOf, type Nat } from '../../engine/numbers/nat';
import { num } from '../../engine/proof/q';
import { FormulaView } from '../../ui/FormulaView';
import { ProofDebugger } from '../../ui/ProofDebugger';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { Mark } from './common';
import { FUNCTIONS, parseArgList } from './functions';
import './represent2.css';

function size(n: Nat, inner?: Nat): string {
  const m = magnitude(n);
  if (m && (('L' in m && Number.isFinite(m.L)) || ('LL' in m && Number.isFinite(m.LL)))) return formatMagnitude(m);
  const mi = inner ? magnitude(inner) : null;
  if (mi && 'L' in mi && Number.isFinite(mi.L)) return `a number of digits that itself has at least ${Math.max(1, Math.floor(mi.L - 0.33) + 1).toLocaleString('en-US')} digits`;
  return 'far too many digits to write down';
}

export function SearchLab() {
  const [id, setId] = useState('add');
  const entry = FUNCTIONS.find((f) => f.id === id)!;
  const [argText, setArgText] = useState(entry.args.join(', '));
  const [wrongText, setWrong] = useState('');
  const f = useMemo(() => entry.build(), [entry]);
  const rep = useMemo(() => representing(f), [f]);
  const args = useMemo(() => parseArgList(argText, entry.arity, 5n), [argText, entry]);
  const choose = (i: string) => {
    setId(i);
    setArgText(FUNCTIONS.find((x) => x.id === i)!.args.join(', '));
    setWrong('');
  };
  const data = useMemo(() => {
    if (typeof args === 'string' || 'error' in rep) return null;
    const ev = evaluate(f, args, { fuel: 100_000, maxTraceDepth: -1 });
    if (ev.status !== 'ok' || ev.value === undefined) return null;
    const m = ev.value;
    const cl = deriveClauses(f, args);
    if ('error' in cl) return { error: cl.error };
    const chk = check(cl.a, { axioms: Q() });
    const enc = encodeDerivation(cl.a, { axioms: Q() });
    if (!enc.ok) return { error: enc.error };
    const target = instance(rep, args, num(m));
    const y = godelNumber(target);
    const s = seqOf([enc.root.code, lit(m)]);
    const r = prf(component(s, 0)!, y, Q());
    return { m, deriv: cl.a, chk, code: enc.root.code, y, s, r, target };
  }, [f, rep, args]);
  const nums = typeof args === 'string' ? '' : args.map((a) => `\\overline{${a}}`).join(', ');
  // An empty field means the suggested wrong value f(n⃗) + 1, shown as the placeholder.
  const wrong = wrongText.trim() === '' ? (data && !('error' in data) ? data.m + 1n : null) : /^\d+$/.test(wrongText.trim()) && Number(wrongText) <= 12 ? BigInt(wrongText.trim()) : null;
  const neg = useMemo(() => {
    if (wrong === null || typeof args === 'string' || !data || 'error' in data || wrong === data.m) return null;
    const r = deriveNotValue(f, args, wrong);
    if ('error' in r) return r;
    return { ...r, chk: check(r.deriv, { axioms: Q() }) };
  }, [wrong, f, args, data]);

  return (
    <div className="workbench">
      <Panel n={1} title="The search, in outline" prov={<Prov kind="added" />}>
        <div className="r2-flow">
          <div className="r2-flow-box">
            <h4>Input <Tex tex="n_0, \ldots, n_k" /></h4>
            Compute the Gödel numbers <Tex tex="A(\vec n, m) = \#A_f(\overline{n_0}, \ldots, \overline{n_k}, \overline m)\#" /> with <Tex tex="\mathrm{Subst}" /> and <Tex tex="\mathrm{num}" /> — primitive recursive.
          </div>
          <div className="r2-flow-arrow">try s = 0, 1, 2, … in turn</div>
          <div className="r2-flow-box accent">
            <h4>
              Test <Tex tex="R(\vec n, s)" />: is <Tex tex="(s)_0" /> the code of a derivation from Q of the formula with Gödel number <Tex tex="A(\vec n, (s)_1)" />?
            </h4>
            <Tex tex="\mathrm{Prf}_{\mathbf Q}((s)_0, A(\vec n, (s)_1))" /> — primitive recursive (<Ref k="inc:art:pnd:prop:prf-prim-rec" />), so each test ends.
          </div>
          <div className="r2-flow-arrow">the first s that passes</div>
          <div className="r2-flow-box checked">
            <h4>
              Output <Tex tex="(s)_1" />
            </h4>
            It is <Tex tex="f(\vec n)" /> by <Ref k="inc:req:rpc:lem:rep-q" />: Q proves <Tex tex="A_f(\vec{\overline n}, \overline m)" /> only for <Tex tex="m = f(\vec n)" />. The search ends because such a derivation exists (clause (a)).
          </div>
        </div>
        <p className="wb-note">
          So <Tex tex="f(\vec n) = (\mu s\, R(\vec n, s))_1" />, a regular minimization of a primitive recursive relation. The search itself is hopeless in practice — the codes are astronomically large — but only its existence matters.
        </p>
      </Panel>
      <Panel n={2} title="A pair s that passes the test" prov={data && !('error' in data) && data.r.holds ? <Prov kind="checked" /> : <Prov kind="computed" />}>
        <div className="seg" role="radiogroup" aria-label="Function">
          {FUNCTIONS.map((x) => (
            <button key={x.id} className="chip-btn" role="radio" aria-checked={x.id === id} aria-pressed={x.id === id} onClick={() => choose(x.id)}>
              <Tex tex={`f = ${x.label}`} />
            </button>
          ))}
        </div>
        <div className="r2-row">
          <label>
            input
            <input className={`r2-input ${typeof args === 'string' ? 'invalid' : ''}`} value={argText} onChange={(e) => setArgText(e.target.value)} aria-label="input numbers" />
          </label>
        </div>
        {typeof args === 'string' && <p className="r2-err">{args}</p>}
        {data && 'error' in data && <p className="r2-err">{data.error}</p>}
        {data && !('error' in data) && (
          <div aria-live="polite">
            <p className="wb-note">
              <Tex tex={`f(${typeof args === 'string' ? '' : args.join(', ')}) = ${data.m}`} />. The representing formula instance:
            </p>
            <div className="r2-formula-line">
              <FormulaView node={data.target} />
            </div>
            <ProofDebugger deriv={data.deriv} check={data.chk} title={<span>δ: clause (a), a derivation in Q</span>} />
            <dl className="r2-kv">
              <dt>
                <Tex tex="\#\delta\#" />
              </dt>
              <dd>coded as in <Ref k="inc:art:pnd:sec" />: {size(data.code, data.y)}</dd>
              <dt>
                <Tex tex="s" />
              </dt>
              <dd>
                <Tex tex={`\\langle \\#\\delta\\#, ${data.m}\\rangle`} />
              </dd>
              <dt>
                <Tex tex="A(\vec n, (s)_1)" />
              </dt>
              <dd>
                <Tex tex={`\\#A_f(${nums}, \\overline{${data.m}})\\#`} />: {size(data.y)}
              </dd>
            </dl>
            <ul className="r2-small sans" style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>
                <Tex tex="\mathrm{Deriv}((s)_0)" />: it decodes to a derivation every inference of which the checker accepts <Mark ok={data.r.deriv} />
              </li>
              <li>
                <Tex tex="\mathrm{EndFmla}((s)_0) = A(\vec n, (s)_1)" /> (compared as exact symbolic numbers) <Mark ok={data.r.endFormula} />
              </li>
              <li>
                its undischarged assumptions are axioms of Q ({[...new Set(data.r.open.map((o) => o.axiom ?? '?'))].sort().join(', ') || 'none'}) <Mark ok={data.r.openInGamma} />
              </li>
            </ul>
            <p className="wb-note">
              So <Tex tex="R(\vec n, s)" /> holds for this <Tex tex="s" />, and <Tex tex={`(s)_1 = ${data.m}`} />. The minimization would return the <em>least</em> such <Tex tex="s" />, which this workbench does not look for; whatever it is, its second component is <Tex tex={`${data.m}`} />, by the lemma.
            </p>
          </div>
        )}
      </Panel>
      {data && !('error' in data) && (
        <Panel n={3} title="A wrong value can never pass" prov={neg && !('error' in neg) && neg.chk.valid ? <Prov kind="checked" /> : <Prov kind="computed" />}>
          <p className="wb-note">
            <Ref k="inc:req:rpc:lem:rep-q" />: if <Tex tex="m' \neq f(\vec n)" />, clause (b) and <Tex tex="\overline{m'} \neq \overline{f(\vec n)}" /> give <Tex tex="\mathbf Q \vdash \lnot A_f(\vec{\overline n}, \overline{m'})" />. Were <Tex tex="A_f(\vec{\overline n}, \overline{m'})" /> also derivable, Q would be inconsistent — impossible, since all its axioms are true in the standard model. Try a wrong value:
          </p>
          <div className="r2-row">
            <label>
              <Tex tex="m' =" />
              <input className="r2-input num" value={wrongText} onChange={(e) => setWrong(e.target.value)} placeholder={String(data.m + 1n)} aria-label="a wrong value m′" inputMode="numeric" />
            </label>
            {wrongText.trim() !== '' && wrong === null && <span className="r2-err">a number up to 12</span>}
            {wrong !== null && wrong === data.m && <span className="r2-muted r2-small">that is the right value</span>}
          </div>
          <div aria-live="polite">
            {neg && 'error' in neg && <p className="r2-err">{neg.error}</p>}
            {neg && !('error' in neg) && <ProofDebugger deriv={neg.deriv} check={neg.chk} title={<Tex tex={`\\mathbf Q \\vdash \\lnot A_f(${nums}, \\overline{${wrong}})`} />} />}
          </div>
          <NotAProof>
            The derivations are generated for these numbers and checked. The lemma and the computability of representable functions are proved in the text for all functions and inputs.
          </NotAProof>
        </Panel>
      )}
    </div>
  );
}
