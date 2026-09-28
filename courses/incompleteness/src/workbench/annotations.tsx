// Small panels that work the reader's object through a specific definition or proposition of the
// formal text. Each is marked Computed or Checked.

import { useMemo, type ReactNode } from 'react';
import { Added, NotAProof, Prov } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { FormulaView } from '../ui/FormulaView';
import { NatView } from '../ui/NatView';
import { ProofDebugger } from '../ui/ProofDebugger';
import { useStore } from '../ui/store';
import { useParsedFormula, useParsedTerm, functionStore, substStore, ABBREVIATIONS } from '../content/objects';
import { analyze } from '../engine/syntax/analysis';
import { godel, decode } from '../engine/coding/godel';
import { children, type Node, type Term } from '../engine/syntax/ast';
import { occurrences } from '../engine/syntax/ops';
import { freeFor } from '../engine/syntax/subst';
import { tryParseFormula, tryParseTerm } from '../engine/syntax/parse';
import { symbolCode, varIndex, varName, varTex, symTex } from '../engine/syntax/language';
import { termTex } from '../engine/syntax/print';
import { formatMagnitude, magnitude } from '../engine/numbers/nat';
import { buildWithPaths } from './FunctionBuilder';
import { arity } from '../engine/recursive/rf';
import { deriveClauses, instance, representing } from '../engine/represent/represent';
import { check } from '../engine/proof/nd';
import { num, Q } from '../engine/proof/q';
import { formulaTex } from '../engine/syntax/print';
import * as A from '../engine/syntax/ast';
import { CodeTable, positions } from './coding';
import { ArithPanel } from './SubstitutionLab';

function Frame({ kind = 'computed', title, children: body }: { kind?: 'computed' | 'checked'; title: ReactNode; children: ReactNode }) {
  return (
    <Added label={kind === 'checked' ? 'Checked, for your object' : 'Computed, for your object'}>
      <div className="ann-title sans">
        <b>{title}</b> <Prov kind={kind} />
      </div>
      {body}
    </Added>
  );
}

export function YourSymbolCodes() {
  const [, , parsed] = useParsedFormula();
  const enc = useMemo(() => (parsed.ok ? godel(parsed.value) : null), [parsed]);
  const a = useMemo(() => (enc ? analyze(enc.expanded) : null), [enc]);
  if (!enc || !a) return null;
  return (
    <Frame title="The symbols of your formula, coded by this definition">
      <p>
        <FormulaView node={enc.expanded} analysis={a} />
      </p>
      <CodeTable enc={enc} analysis={a} limit={14} />
    </Frame>
  );
}

export function V5Example() {
  const c = symbolCode({ k: 'var', index: 5 });
  return (
    <Frame title="The explanation’s numbers">
      <p>
        <Tex tex={`\\mathrm{c}_{v_5} = \\langle 1, 5\\rangle = 2^2 \\cdot 3^6 = ${c}`} />, while <Tex tex={`\\#v_5\\# = \\langle ${c} \\rangle = 2^{${c + 1n}}`} />, a number with{' '}
        {formatMagnitude(magnitude(godel(A.v(5)).number))}.
      </p>
    </Frame>
  );
}

export function YourGodelNumber() {
  const [, , parsed] = useParsedFormula();
  const enc = useMemo(() => (parsed.ok ? godel(parsed.value) : null), [parsed]);
  if (!enc) return null;
  const pos = positions(enc.items);
  const syms = enc.items.filter((it, i) => it.k === 'sym' && pos[i] !== null).slice(0, 6) as Extract<(typeof enc.items)[number], { k: 'sym' }>[];
  return (
    <Frame title="The example, redone for your formula">
      <p>
        <Tex tex={`\\#A\\# = ${syms.map((s, i) => `p_{${i}}^{\\mathrm{c}_{${symTex(s.sym)}}+1}`).join(' \\cdot ')}${enc.items.length > 6 ? ' \\cdots' : ''}`} />
      </p>
      <NatView n={enc.number} style="powers" maxItems={6} />
    </Frame>
  );
}

/** The subterms of a term in the order a formation sequence lists them. */
function formationSequence(t: Term): Term[] {
  const out: Term[] = [];
  const seen = new Set<string>();
  const go = (x: Node) => {
    for (const ch of children(x)) go(ch);
    const key = termTex(x as Term);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(x as Term);
    }
  };
  go(t);
  return out;
}

export function YourFormationSequence() {
  const [, , parsed] = useParsedTerm();
  if (!parsed.ok) return null;
  const seq = formationSequence(parsed.value);
  return (
    <Frame title="A formation sequence for your term">
      <p className="sans small muted">Each entry is a variable or constant, or is built from earlier entries by a function symbol — the condition the proof expresses primitive recursively.</p>
      <ol className="formation">
        {seq.map((s, i) => (
          <li key={i}>
            <FormulaView node={s} /> <span className="muted small sans">— Gödel number with {formatMagnitude(magnitude(godel(s).number))}</span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

export function YourFrm() {
  const [, , parsed] = useParsedFormula();
  const r = useMemo(() => (parsed.ok ? decode(godel(parsed.value).number, { expect: 'formula', abbreviations: ABBREVIATIONS }) : null), [parsed]);
  if (!r) return null;
  return (
    <Frame title="Frm, decided for the Gödel number of your formula">
      <p>
        Decoding <Tex tex="\#A\#" /> {r.ok ? 'succeeds: its symbols form a formula, so ' : 'fails, so '}
        <Tex tex={`\\mathrm{Frm}(\\#A\\#)`} /> {r.ok ? 'holds' : 'fails'}. Deleting its last symbol gives a number for which <Tex tex="\mathrm{Frm}" /> fails — try it in the
        decoder of Explore mode.
      </p>
    </Frame>
  );
}

export function YourFreeOcc() {
  const [, , parsed] = useParsedFormula();
  const data = useMemo(() => {
    if (!parsed.ok) return null;
    const enc = godel(parsed.value);
    const pos = positions(enc.items);
    const vars = new Set<number>();
    A.walk(enc.expanded, (n) => n.k === 'var' && vars.add(n.index));
    const rows = [...vars].map((v) => {
      const free = new Set(occurrences(enc.expanded, v).filter((o) => o.free).map((o) => o.node.id));
      const hits = enc.items.map((it, i) => (it.k === 'sym' && it.sym.k === 'var' && it.sym.index === v && it.role !== 'binder-var' && free.has(it.node) ? pos[i] : null)).filter((x): x is number => x !== null);
      return { v, hits };
    });
    return rows;
  }, [parsed]);
  if (!data) return null;
  return (
    <Frame title="FreeOcc for your formula">
      <ul className="sans small">
        {data.map((r) => (
          <li key={r.v}>
            <Tex tex={`\\mathrm{FreeOcc}(\\#A\\#, \\#${varTex(r.v)}\\#, i)`} /> holds for {r.hits.length ? <>i ∈ {'{'}{r.hits.join(', ')}{'}'}</> : 'no i'}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function YourArithSubst() {
  const s = useStore(substStore);
  const pf = useMemo(() => tryParseFormula(s.formula, { abbreviations: ABBREVIATIONS }), [s.formula]);
  const pt = useMemo(() => tryParseTerm(s.term), [s.term]);
  if (!pf.ok || !pt.ok) return null;
  return (
    <Added label="Computed, for your object">
      <ArithPanel A={pf.value} t={pt.value} u={varIndex(s.variable) ?? 0} />
    </Added>
  );
}

export function YourFreeFor() {
  const s = useStore(substStore);
  const pf = useMemo(() => tryParseFormula(s.formula, { abbreviations: ABBREVIATIONS }), [s.formula]);
  const pt = useMemo(() => tryParseTerm(s.term), [s.term]);
  if (!pf.ok || !pt.ok) return null;
  const r = freeFor(pt.value, varIndex(s.variable) ?? 0, pf.value);
  return (
    <Frame title="FreeFor for your substitution">
      <p>
        <Tex tex={`\\mathrm{FreeFor}(\\#A\\#, \\#${termTex(pt.value)}\\#, \\#${s.variable}\\#)`} /> {r.ok ? 'holds' : 'fails'}
        {r.ok ? '.' : `: ${r.hazards.length} occurrence(s) of ${s.variable} lie in the scope of a quantifier binding ${[...new Set(r.hazards.map((h) => varName(h.variable)))].join(', ')}.`}
      </p>
    </Frame>
  );
}

export function YourClauses({ which = 'both' }: { which?: 'both' | 'b' }) {
  const f = useStore(functionStore);
  const rf = useMemo(() => buildWithPaths(f.spec), [f.spec]);
  const ar = arity(rf);
  const args = useMemo(() => (ar.ok ? f.args.split(/[\s,]+/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? BigInt(x) : -1n)) : []), [f.args, ar]);
  const ok = ar.ok && args.length === ar.arity && args.every((x) => x >= 0n && x <= 12n);
  const rep = useMemo(() => (ar.ok ? representing(rf) : null), [rf, ar]);
  const r = useMemo(() => (ok ? deriveClauses(rf, args) : null), [rf, args, ok]);
  const c = useMemo(() => (r && !('error' in r) ? { a: check(r.a, { axioms: Q() }), b: check(r.b, { axioms: Q() }) } : null), [r]);
  if (!rep || 'error' in rep) return <Frame title="Your function">{rep ? <p className="sans small">{rep.error}.</p> : <p>The function in the workbench is ill-formed.</p>}</Frame>;
  if (!r || !c) return <Frame title="Your function">{<p className="sans small">Choose small arguments for your function in Explore mode.</p>}</Frame>;
  if ('error' in r) return <Frame title="Your function">{<p className="sans small">{r.error}.</p>}</Frame>;
  const target = A.forall(A.v(rep.output), A.imp(instance(rep, args, A.v(rep.output)), A.eq(A.v(rep.output), num(r.value))));
  return (
    <Frame kind="checked" title={<>For your function at ({args.join(', ')}), with value {r.value.toString()}</>}>
      {which === 'both' && (
        <>
          <p>
            (a) <Tex tex={`\\mathbf Q \\vdash ${formulaTex(r.a.concl)}`} /> — {c.a.valid ? `checked, ${c.a.size} inferences` : 'rejected'}
          </p>
          <p>
            (b) <Tex tex={`\\mathbf Q \\vdash ${formulaTex(target)}`} /> — {c.b.valid ? `checked, ${c.b.size} inferences` : 'rejected'}
          </p>
        </>
      )}
      {which === 'b' && <ProofDebugger deriv={r.b} check={c.b} title="Clause (b), the uniqueness half" />}
      <NotAProof />
    </Frame>
  );
}

