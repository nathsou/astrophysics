// Representability: a function built from the basis of chapter 4, its computation, the formula
// A_f that represents it, and derivations in Q of the two clauses for the chosen input.

import { useMemo, useState, type ReactNode } from 'react';
import { functionStore, type RFSpec } from '../content/objects';
import { useStore, highlightStore, inspect } from '../ui/store';
import { arity, evaluate, events, rfTex, type Call, type RF } from '../engine/recursive/rf';
import { deriveClauses, instance, representing, type Representation } from '../engine/represent/represent';
import { check } from '../engine/proof/nd';
import { num } from '../engine/proof/q';
import { analyze } from '../engine/syntax/analysis';
import { formulaTex } from '../engine/syntax/print';
import { FormulaView } from '../ui/FormulaView';
import { ProofDebugger } from '../ui/ProofDebugger';
import { Stepper } from '../ui/Stepper';
import { Prov, NotAProof } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { Ref } from '../formal/FormalText';
import { Panel } from './coding';
import { buildWithPaths, FunctionBuilder, specTex } from './FunctionBuilder';
import * as A from '../engine/syntax/ast';

export const FUNCTION_EXAMPLES: { label: string; spec: RFSpec; args: string }[] = [
  { label: 'h(x) = x + 2', spec: { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'succ' }] }, args: '3' },
  { label: 'h(x) = 2x', spec: { k: 'comp', f: { k: 'basic', name: 'add' }, gs: [{ k: 'proj', n: 1, i: 0 }, { k: 'proj', n: 1, i: 0 }] }, args: '3' },
  { label: 'h(x) = x · (x + 1)', spec: { k: 'comp', f: { k: 'basic', name: 'mult' }, gs: [{ k: 'proj', n: 1, i: 0 }, { k: 'succ' }] }, args: '2' },
  { label: 'h(x, y) = χ=(x·y, x+y)', spec: { k: 'comp', f: { k: 'basic', name: 'chareq' }, gs: [{ k: 'basic', name: 'mult' }, { k: 'basic', name: 'add' }] }, args: '2, 2' },
  { label: 'add, as a basic function', spec: { k: 'basic', name: 'add' }, args: '2, 3' },
  { label: 'χ=', spec: { k: 'basic', name: 'chareq' }, args: '1, 3' },
  { label: 'μx [χ=(x, z) = 0]', spec: { k: 'min', f: { k: 'basic', name: 'chareq' } }, args: '0' },
  { label: 'add by primitive recursion', spec: { k: 'rec', f: { k: 'proj', n: 1, i: 0 }, g: { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'proj', n: 3, i: 2 }] } }, args: '2, 3' },
];

function parseArgs(s: string, k: number): bigint[] | string {
  const parts = s.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== k) return `${k} argument${k === 1 ? '' : 's'} needed`;
  if (!parts.every((p) => /^\d+$/.test(p))) return 'arguments must be natural numbers';
  const xs = parts.map(BigInt);
  if (xs.some((x) => x > 12n)) return 'keep the arguments small (at most 12): derivations grow with the numbers';
  return xs;
}

export function RepresentabilityLab({ derivations = true, focus }: { derivations?: boolean; focus?: 'basic' | 'composition' | 'minimization' }) {
  const state = useStore(functionStore);
  const rf = useMemo(() => buildWithPaths(state.spec), [state.spec]);
  const ar = useMemo(() => arity(rf), [rf]);
  const errors = useMemo(() => new Map(ar.ok ? [] : ar.errors.map((e) => [e.id, e.message] as const)), [ar]);
  const rep = useMemo(() => (ar.ok ? representing(rf) : null), [rf, ar]);
  const args = ar.ok ? parseArgs(state.args, ar.arity) : 'fix the definition first';
  const setSpec = (spec: RFSpec) => functionStore.set({ ...state, spec });
  const hoverPath = (path: string | null) => {
    if (!path) return highlightStore.set(null);
    const formulaIds = rep && !('error' in rep) ? [...rep.origin].filter(([, p]) => p === path || p.startsWith(`${path}.`)).map(([id]) => id) : [];
    highlightStore.set({ primary: [path, ...formulaIds], secondary: [] });
  };
  return (
    <div className="workbench">
      <div className="fn-examples">
        <span className="fi-label">Examples</span>
        {FUNCTION_EXAMPLES.filter((x) => !focus || (focus === 'minimization' ? x.spec.k === 'min' : focus === 'basic' ? x.spec.k === 'basic' : x.spec.k === 'comp')).concat(focus ? [] : []).map((x) => (
          <button key={x.label} className="chip-btn" onClick={() => functionStore.set({ spec: x.spec, args: x.args })}>
            {x.label}
          </button>
        ))}
      </div>
      <Panel n={1} title="The function" prov={ar.ok ? <span className="muted small sans">{ar.arity}-place</span> : <Prov kind="failed">ill-formed</Prov>}>
        <p className="wb-note">
          <Ref k="inc:req::chap" /> uses the basic functions zero, succ, <Tex tex="P^n_i" />, add, mult and <Tex tex="\chi_=" />, with composition and regular minimization. Build a
          function from them; hover a part to find it in the formula below.
        </p>
        <FunctionBuilder spec={state.spec} onChange={setSpec} errors={errors} onHover={hoverPath} />
        <label className="args-input sans">
          arguments{' '}
          <input value={state.args} onChange={(e) => functionStore.set({ ...state, args: e.target.value })} aria-label="arguments" />
        </label>
        {typeof args === 'string' && <span className="fi-error"> {args}</span>}
      </Panel>
      {ar.ok && typeof args !== 'string' && <Computation rf={rf} args={args} onHover={hoverPath} />}
      {rep && 'error' in rep && (
        <Panel n={3} title="The representing formula">
          <p className="wb-note">{rep.error}.</p>
          {rep.id && <p className="muted small">The problem is at the highlighted part of the definition.</p>}
        </Panel>
      )}
      {rep && !('error' in rep) && <FormulaPanel rep={rep} rf={rf} />}
      {rep && !('error' in rep) && typeof args !== 'string' && derivations && <DerivationPanel rf={rf} rep={rep} args={args} />}
    </div>
  );
}

function callLabel(c: Call): string {
  const f = c.fn;
  const name = f.k === 'comp' ? 'h' : f.k === 'min' ? '\\mu' : f.k === 'rec' ? 'h' : rfTex(f);
  return `${name}(${c.args.join(', ')})`;
}

function Computation({ rf, args, onHover }: { rf: RF; args: bigint[]; onHover: (p: string | null) => void }) {
  const ev = useMemo(() => evaluate(rf, args, { fuel: 5000 }), [rf, args]);
  const evs = useMemo(() => events(ev.root), [ev]);
  const [step, setStep] = useState(0);
  const s = Math.min(step, evs.length - 1);
  const cur = evs[s];
  // the call stack at step s
  const stack: Call[] = [];
  for (let i = 0; i <= s; i++) {
    const e = evs[i];
    if (e.kind === 'enter') stack.push(e.call);
    else stack.pop();
  }
  return (
    <Panel n={2} title="The computation" prov={<Prov kind="computed" />}>
      {ev.status === 'ok' ? (
        <p className="wb-result">
          <Tex tex={`f(${args.join(', ')}) = ${ev.value}`} /> <span className="muted small sans">in {ev.calls} function calls</span>
        </p>
      ) : (
        <p className="wb-note danger">
          The computation did not finish within the step budget. That does not show the function is undefined here — only that this search ran long. (A minimization is{' '}
          <em>regular</em> if the search always succeeds.)
        </p>
      )}
      <Stepper
        step={s}
        count={evs.length}
        onStep={(i) => {
          setStep(i);
          onHover(evs[i].call.fn.id);
        }}
        label="trace"
        describe={() => (
          <>
            {cur.kind === 'enter' ? 'call ' : 'return from '}
            <Tex tex={callLabel(cur.call)} />
            {cur.kind === 'exit' && cur.call.value !== undefined && <> with value {cur.call.value.toString()}</>}
            {cur.call.note && <span className="muted"> — {cur.call.note}</span>}
          </>
        )}
      />
      <div className="call-stack" role="group" aria-label="Call stack">
        {stack.map((c, i) => (
          <div key={c.key} className="call-frame" style={{ marginLeft: i * 14 }} data-n={c.fn.id} onMouseEnter={() => onHover(c.fn.id)}>
            <Tex tex={callLabel(c)} />
            {c.value !== undefined && (cur.kind === 'exit' || c !== stack[stack.length - 1]) && c.value !== undefined && evs.slice(0, s + 1).some((e) => e.kind === 'exit' && e.call === c) ? (
              <span className="muted"> = {c.value.toString()}</span>
            ) : null}
          </div>
        ))}
      </div>
      <details className="call-tree-wrap">
        <summary className="sans small">the whole call tree</summary>
        <CallTree c={ev.root} onHover={onHover} />
      </details>
    </Panel>
  );
}

function CallTree({ c, onHover }: { c: Call; onHover: (p: string | null) => void }): ReactNode {
  return (
    <ul className="call-tree">
      <li>
        <span data-n={c.fn.id} onMouseEnter={() => onHover(c.fn.id)}>
          <Tex tex={`${callLabel(c)} = ${c.value ?? '?'}`} />
          {c.note && <span className="muted small"> {c.note}</span>}
        </span>
        {c.children.length > 0 && c.children.map((ch) => <CallTree key={ch.key} c={ch} onHover={onHover} />)}
      </li>
    </ul>
  );
}

function FormulaPanel({ rep, rf }: { rep: Representation; rf: RF }) {
  const a = useMemo(() => analyze(rep.formula), [rep]);
  const byPath = useMemo(() => {
    const m = new Map<string, RF>();
    const go = (g: RF) => {
      m.set(g.id, g);
      if (g.k === 'comp') {
        go(g.f);
        g.gs.forEach(go);
      } else if (g.k === 'min') go(g.f);
      else if (g.k === 'rec') {
        go(g.f);
        go(g.g);
      }
    };
    go(rf);
    return m;
  }, [rf]);
  return (
    <Panel n={3} title={<>The formula <Tex tex="A_f(x_0, \ldots, y)" /> that represents it</>} prov={<Prov kind="computed">built as in the book</Prov>}>
      <p className="wb-note">
        Built part by part as in <Ref k="inc:req:bre:sec" />, <Ref k="inc:req:cmp:sec" /> and <Ref k="inc:req:min:sec" />: each basic function has a formula, a composition
        becomes <Tex tex="\exists y\,(A_g(\vec x, y) \land A_f(y, z))" />, a minimization becomes <Tex tex="A_g(y, \vec z, 0) \land \forall w\,(w < y \rightarrow \lnot A_g(w, \vec z, 0))" />.
      </p>
      <div className="wb-formula wide">
        <FormulaView
          node={rep.formula}
          analysis={a}
          onHoverNode={(id) => {
            const p = rep.origin.get(id);
            if (p) highlightStore.update((h) => (h ? { ...h, secondary: [...(h.secondary ?? []), p] } : h));
          }}
          describe={(id) => {
            const p = rep.origin.get(id);
            const g = p ? byPath.get(p) : undefined;
            return g ? (
              <p>
                This part comes from <Tex tex={g.k === 'comp' ? '\\text{a composition}' : g.k === 'min' ? '\\text{a minimization}' : rfTex(g)} /> in the definition (highlighted
                there).
              </p>
            ) : null;
          }}
        />
      </div>
      <p className="muted small sans">
        Inputs are <Tex tex="x_0, x_1, \ldots" />, the output is <Tex tex="y" />; the other variables are bound. Its syntax tree has {countNodes(rep.formula)} nodes.
      </p>
    </Panel>
  );
}

function countNodes(f: A.Node): number {
  let n = 0;
  A.walk(f, () => n++);
  return n;
}

function DerivationPanel({ rf, rep, args }: { rf: RF; rep: Representation; args: bigint[] }) {
  const r = useMemo(() => deriveClauses(rf, args), [rf, args]);
  const checks = useMemo(() => ('error' in r ? null : { a: check(r.a, { axioms: r.axioms }), b: check(r.b, { axioms: r.axioms }) }), [r]);
  const [which, setWhich] = useState<'a' | 'b'>('a');
  if ('error' in r) {
    return (
      <Panel n={4} title="Derivations in Q">
        <p className="wb-note">Not generated here: {r.error}.</p>
      </Panel>
    );
  }
  const m = r.value;
  const inst = instance(rep, args, num(m));
  const target = A.forall(A.v(rep.output), A.imp(instance(rep, args, A.v(rep.output)), A.eq(A.v(rep.output), num(m))));
  return (
    <Panel n={4} title={<>Q derives both clauses for this input</>} prov={checks && checks.a.valid && checks.b.valid ? <Prov kind="checked" /> : <Prov kind="failed">not accepted</Prov>}>
      <p className="wb-note">
        <Ref k="inc:req:int:defn:representable-fn" /> asks for two things whenever <Tex tex={`f(${args.join(', ')}) = ${m}`} />:
      </p>
      <ol className="clauses">
        <li>
          <button className="linklike" onClick={() => setWhich('a')} aria-pressed={which === 'a'}>
            (a)
          </button>{' '}
          <Tex tex={`\\mathbf{Q} \\vdash ${formulaTex(inst)}`} />
        </li>
        <li>
          <button className="linklike" onClick={() => setWhich('b')} aria-pressed={which === 'b'}>
            (b)
          </button>{' '}
          <Tex tex={`\\mathbf{Q} \\vdash ${formulaTex(target)}`} />
        </li>
      </ol>
      <p className="wb-note">
        Both derivations below were generated from the computation (it supplies the witnesses for <Tex tex="\exists" />) and then verified, inference by inference, by the
        natural deduction checker. Click a step to see what it claims, what it uses and which rule allows it.
      </p>
      {r.minimization && (
        <p className="wb-note">
          A minimization: as in the proof of <Ref k="inc:req:min:prop:rep-minimization" />, the derivations use <Ref k="inc:req:min:lem:less-zero" />, <Ref k="inc:req:min:lem:less-nsucc" /> and{' '}
          <Ref k="inc:req:min:lem:trichotomy" /> — their derivations, generated for the numbers needed, are part of these — and Q8, which the checker is given with ↔ written out as the book defines it.
        </p>
      )}
      <div className="seg" role="tablist" aria-label="Clause">
        <button className="chip-btn" role="tab" aria-selected={which === 'a'} onClick={() => setWhich('a')}>
          clause (a)
        </button>
        <button className="chip-btn" role="tab" aria-selected={which === 'b'} onClick={() => setWhich('b')}>
          clause (b)
        </button>
      </div>
      {checks && (which === 'a' ? <ProofDebugger key="a" deriv={r.a} check={checks.a} title="Clause (a)" /> : <ProofDebugger key="b" deriv={r.b} check={checks.b} title="Clause (b)" />)}
      <NotAProof>
        These are derivations for the input ({args.join(', ')}). That every such function is representable, for all inputs, is <Ref k="inc:req:int:thm:representable-iff-comp" />,
        proved in the text by induction on the definition of the function.
      </NotAProof>
      <button className="chip-btn" onClick={() => inspect({ key: 'rep-why', kicker: 'Why two clauses?', title: 'Representing a function', body: <p>Clause (a) says the formula holds of the right output; clause (b) says it holds of no other. Together they make the formula a faithful description of the graph of the function <em>inside</em> Q — which is what the incompleteness proof needs, since it can only use what Q proves.</p> }, true)}>
        why two clauses?
      </button>
    </Panel>
  );
}

export { specTex };
