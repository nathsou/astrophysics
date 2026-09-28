// Gödel numbers of derivations (section "Derivations in Natural Deduction"): a checked derivation,
// its code as nested tuples ⟨k, #δ₁#, …, #A#, n, rule⟩, decoding back (and what the checker says
// when a component of the code is changed), and the book's functions on codes: EndFmla,
// DischargeLabel, LastRule, SubtreeSeq, Assum / OpenAssum, Prf_Q.

import { useMemo, useState } from 'react';
import type { Formula } from '../../engine/syntax/ast';
import { tryParseFormula } from '../../engine/syntax/parse';
import { isSentence } from '../../engine/syntax/ops';
import { formulaTex } from '../../engine/syntax/print';
import { check, RULE_NAMES, type CheckResult, type Deriv } from '../../engine/proof/nd';
import { Q } from '../../engine/proof/q';
import { decode as decodeFormula, godelNumber } from '../../engine/coding/godel';
import { formatMagnitude, magnitude, natEq, type Nat } from '../../engine/numbers/nat';
import {
  assumptionOccurrences, codedNodes, decodeDerivation, dischargeLabel, encodeDerivation, lastRule, pathKey, prf, recode,
  RULE_OF_NUMBER, subtreeSeq, type CodedNode, type Overrides,
} from '../../engine/coding/derivations';
import { DERIVATION_EXAMPLES } from '../../engine/coding/derivation-examples';
import { persistedStore, useStore } from '../../ui/store';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { ProofDebugger } from '../../ui/ProofDebugger';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { Mark } from './common';
import './represent2.css';

export const abStore = persistedStore('ic.pnd.AB', { A: '0 = 0', B: '0 < 1', example: 'book' });

const posText = (p: number[]) => (p.length ? p.map((x) => x + 1).join('.') : 'root');

function sizeOf(n: Nat, inner?: Nat): string {
  const m = magnitude(n);
  const t = formatMagnitude(m);
  if (m && 'LL' in m && Number.isFinite(m.LL)) return t;
  if (m && 'L' in m && Number.isFinite(m.L)) return t;
  // Too large even for the estimate: bound it by the exponent #A# + 1 of the prime 3 (or 2).
  const mi = inner ? magnitude(inner) : null;
  if (mi && 'L' in mi && Number.isFinite(mi.L)) return `a number of digits that itself has at least ${Math.max(1, Math.floor(mi.L - 0.33) + 1).toLocaleString('en-US')} digits`;
  return 'far too many digits to write down';
}

export function useCodedExample(id?: string) {
  const ab = useStore(abStore);
  const ex = DERIVATION_EXAMPLES.find((e) => e.id === (id ?? ab.example)) ?? DERIVATION_EXAMPLES[0];
  const pa = useMemo(() => tryParseFormula(ab.A), [ab.A]);
  const pb = useMemo(() => tryParseFormula(ab.B), [ab.B]);
  const aErr = !pa.ok ? pa.error : !isSentence(pa.value) ? 'A must be a sentence (no free variables)' : null;
  const bErr = !pb.ok ? pb.error : !isSentence(pb.value) ? 'B must be a sentence (no free variables)' : null;
  const ready = !ex.usesAB || (!aErr && !bErr);
  const built = useMemo(() => {
    if (!ready) return null;
    const a = (pa.ok ? pa.value : null) as Formula;
    const b = (pb.ok ? pb.value : null) as Formula;
    const deriv = ex.build(a, b);
    const axioms = ex.fromQ ? Q() : undefined;
    const enc = encodeDerivation(deriv, { axioms });
    return { deriv, axioms, enc };
  }, [ex, ready, pa, pb]);
  return { ab, ex, aErr, bErr, built };
}

export function DerivationCodeLab() {
  const { ab, ex, aErr, bErr, built } = useCodedExample();
  const [overrides, setOverrides] = useState<Overrides>(new Map());
  const [sel, setSel] = useState<string | null>(null);
  const pick = (id: string) => {
    abStore.set({ ...ab, example: id });
    setOverrides(new Map());
    setSel(null);
  };
  return (
    <div className="workbench">
      <Panel n={1} title="A derivation" prov={built?.enc.ok ? <Prov kind="checked" /> : undefined}>
        <div className="seg" role="radiogroup" aria-label="Derivation">
          {DERIVATION_EXAMPLES.map((e) => (
            <button key={e.id} className="chip-btn" role="radio" aria-checked={e.id === ex.id} aria-pressed={e.id === ex.id} onClick={() => pick(e.id)}>
              {e.title}
            </button>
          ))}
        </div>
        {ex.usesAB && (
          <div className="r2-row">
            <label>
              <Tex tex="A =" />
              <input className={`r2-input ${aErr ? 'invalid' : ''}`} value={ab.A} onChange={(e) => abStore.set({ ...ab, A: e.target.value })} aria-label="sentence A" />
            </label>
            <label>
              <Tex tex="B =" />
              <input className={`r2-input ${bErr ? 'invalid' : ''}`} value={ab.B} onChange={(e) => abStore.set({ ...ab, B: e.target.value })} aria-label="sentence B" />
            </label>
          </div>
        )}
        {(aErr || bErr) && ex.usesAB && <p className="r2-err">{aErr ?? bErr}</p>}
        <p className="wb-note">{ex.note}</p>
        {built && <ProofDebugger deriv={built.deriv} check={built.enc.ok ? built.enc.check : check(built.deriv, { axioms: built.axioms })} title={<span>{ex.title}</span>} />}
        {built && !built.enc.ok && <p className="r2-err">No code: {built.enc.error}</p>}
      </Panel>
      {built && built.enc.ok && (
        <CodedPanels
          key={`${ex.id}|${ab.A}|${ab.B}`}
          root={built.enc.root}
          deriv={built.deriv}
          axioms={built.axioms}
          fromQ={!!ex.fromQ}
          overrides={overrides}
          setOverrides={setOverrides}
          sel={sel}
          setSel={setSel}
        />
      )}
    </div>
  );
}

interface CodedProps {
  root: CodedNode;
  deriv: Deriv;
  axioms?: Map<string, Formula>;
  fromQ: boolean;
  overrides: Overrides;
  setOverrides: (o: Overrides) => void;
  sel: string | null;
  setSel: (s: string | null) => void;
}

function CodedPanels({ root, deriv, axioms, fromQ, overrides, setOverrides, sel, setSel }: CodedProps) {
  const code = useMemo(() => (overrides.size ? recode(root, overrides) : root.code), [root, overrides]);
  const decoded = useMemo(() => decodeDerivation(code, { axioms }), [code, axioms]);
  const dchk = useMemo(() => (decoded.ok ? check(decoded.deriv, { axioms }) : null), [decoded, axioms]);
  const nodes = useMemo(() => codedNodes(root), [root]);
  const selNode = nodes.find((n) => pathKey(n.path) === sel) ?? null;
  const used = new Set(nodes.map((n) => n.k).filter((k): k is number => k !== undefined));
  const setOverride = (path: number[], v: { n?: number; k?: number }) => {
    const next = new Map(overrides);
    const key = pathKey(path);
    const cur = { ...(next.get(key) ?? {}), ...v };
    const node = nodes.find((x) => pathKey(x.path) === key)!;
    if (cur.n === node.n) delete cur.n;
    if (cur.k === node.k) delete cur.k;
    if (cur.n === undefined && cur.k === undefined) next.delete(key);
    else next.set(key, cur);
    setOverrides(next);
  };
  return (
    <>
      <Panel n={2} title="Its Gödel number, as nested tuples" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Each sub-derivation is a tuple: the number of premises of its last inference, the codes of the sub-derivations ending in those premises, the Gödel number <span className="r2-gn">#A#</span> of its end-formula, the discharge label <Tex tex="n" />, and the rule number <Tex tex="k" />. An assumption is <Tex tex="\langle 0, \#A\#, n\rangle" />. Select a <b>⟨</b> to change that tuple in panel 3.
        </p>
        <div className="r2-code" aria-label="The code of the derivation">
          <TupleView node={root} overrides={overrides} sel={sel} onSelect={setSel} />
        </div>
        <p className="wb-note">
          The whole number {overrides.size ? '(as changed)' : ''} has {sizeOf(code, root.formulaCode)}. Its end-formula alone, <span className="r2-gn">#A#</span>, has {sizeOf(root.formulaCode)}; the derivation’s code has <span className="r2-gn">#A#</span> + 1 as an exponent. It is an exact number, handled symbolically, and never written out.
        </p>
        <div className="r2-rules" aria-label="The book's rule numbers; rules used here are highlighted">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((k) => (
            <span key={k} className={used.has(k) ? 'used' : ''}>
              {RULE_NAMES[RULE_OF_NUMBER[k]]} <b>{k}</b>
            </span>
          ))}
        </div>
      </Panel>
      <Panel n={3} title="Decoding, and what the checker says" prov={dchk?.valid ? <Prov kind="checked" /> : <Prov kind="computed" />}>
        <p className="wb-note">
          Decoding reads the tuple back: <Tex tex="(d)_0" /> premises, then <Tex tex="\mathrm{EndFmla}(d) = (d)_{(d)_0+1}" />, <Tex tex="\mathrm{DischargeLabel}(d) = (d)_{(d)_0+2}" />, <Tex tex="\mathrm{LastRule}(d) = (d)_{(d)_0+3}" />. The terms of ∀Elim and ∃Intro and the eigenvariables are not in the code; they are read off the formulas. The natural deduction checker then verifies the decoded tree.
        </p>
        <Tamper node={selNode} overrides={overrides} onChange={setOverride} onReset={() => setOverrides(new Map())} />
        <div className="r2-table-wrap">
          <table className="r2-table">
            <caption className="sr-only">Decoding, sub-derivation by sub-derivation</caption>
            <thead>
              <tr>
                <th scope="col">position</th>
                <th scope="col">
                  <Tex tex="(d)_0" />
                </th>
                <th scope="col">end-formula</th>
                <th scope="col">
                  <Tex tex="n" />
                </th>
                <th scope="col">
                  <Tex tex="k" />
                </th>
              </tr>
            </thead>
            <tbody>
              {decoded.steps.map((s) => (
                <tr key={pathKey(s.path)} className={pathKey(s.path) === sel ? 'r2-sel' : ''}>
                  <td>
                    <button className="linklike" onClick={() => setSel(pathKey(s.path))}>
                      {posText(s.path)}
                    </button>
                  </td>
                  <td className="num">{s.kind === 'assumption' ? '0 (assumption, 3 components)' : s.premises}</td>
                  <td>
                    <Tex tex={formulaTex(s.formula)} />
                  </td>
                  <td className="num">{s.n}</td>
                  <td>
                    {s.kind === 'assumption' ? <span className="r2-muted">{s.rule === 'axiom' ? 'axiom of Q (not in the code)' : '—'}</span> : `${s.k} = ${RULE_NAMES[s.rule]}`}
                    {s.recovered && <span className="r2-muted r2-small"> · {s.recovered}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div aria-live="polite">
          {!decoded.ok && (
            <p className="r2-err">
              Decoding stops at position {posText(decoded.path)}: {decoded.error}
            </p>
          )}
          {decoded.ok && dchk && (
            <ProofDebugger
              deriv={decoded.deriv}
              check={dchk}
              title={<span>{overrides.size ? 'Decoded from the changed code' : 'Decoded from the code'}</span>}
            />
          )}
          {decoded.ok && dchk && overrides.size > 0 && !dchk.valid && (
            <p className="wb-note">
              The changed number still decodes to a tree of sentences, but not to a correct derivation: <Tex tex="\mathrm{Correct}(d)" /> fails for some sub-derivation, so <Tex tex="\mathrm{Deriv}(d)" /> is false.
            </p>
          )}
        </div>
      </Panel>
      <BookFunctions code={code} root={root} dchk={dchk} decoded={decoded.ok ? decoded.deriv : null} fromQ={fromQ} deriv={deriv} sel={sel} setSel={setSel} />
    </>
  );
}

function TupleView({ node, overrides, sel, onSelect, suffix = '' }: { node: CodedNode; overrides: Overrides; sel: string | null; onSelect: (k: string | null) => void; suffix?: string }) {
  const key = pathKey(node.path);
  const o = overrides.get(key);
  const n = o?.n ?? node.n;
  const k = o?.k ?? node.k;
  const changed = !!o;
  const selected = sel === key;
  const block = node.premises.length > 0;
  const open = (
    <button className="r2-open" onClick={() => onSelect(selected ? null : key)} aria-pressed={selected} aria-label={`select the ${node.kind} at position ${posText(node.path)}`}>
      ⟨
    </button>
  );
  const fml = (
    <span className="r2-el fml">
      <span>
        <Tex tex={`\\#${formulaTex(node.formula)}\\#`} />
      </span>
      <span className="r2-cap">{node.kind === 'assumption' ? (node.axiom ? `formula (axiom ${node.axiom})` : 'formula') : 'end-formula'}</span>
    </span>
  );
  const label = (
    <span className={`r2-el lbl ${o?.n !== undefined ? 'changed' : ''}`}>
      <span>{n}</span>
      <span className="r2-cap">{node.kind === 'assumption' ? (n ? 'label' : 'undischarged') : n ? 'discharges' : 'no discharge'}</span>
    </span>
  );
  if (node.kind === 'assumption') {
    return (
      <span className={`r2-tuple ${block ? '' : 'inline'} ${selected ? 'r2-sel' : ''} ${changed ? 'r2-changed' : ''}`}>
        {open}
        <span className="r2-el cnt">
          <span>0</span>
          <span className="r2-cap">assumption</span>
        </span>
          , {fml}, {label}⟩{suffix}
      </span>
    );
  }
  const rule = (
    <span className={`r2-el rule ${o?.k !== undefined ? 'changed' : ''}`}>
      <span>{k}</span>
      <span className="r2-cap">{RULE_OF_NUMBER[k!] ? RULE_NAMES[RULE_OF_NUMBER[k!]] : 'no such rule'}</span>
    </span>
  );
  return (
    <span className={`r2-tuple ${selected ? 'r2-sel' : ''} ${changed ? 'r2-changed' : ''}`}>
      <span className="r2-line">
        {open}
        <span className="r2-el cnt">
          <span>{node.premises.length}</span>
          <span className="r2-cap">premise{node.premises.length === 1 ? '' : 's'}</span>
        </span>
        ,
      </span>
      <span className="r2-subs">
        {node.premises.map((p) => (
          <span key={pathKey(p.path)} className="r2-line">
            <TupleView node={p} overrides={overrides} sel={sel} onSelect={onSelect} suffix="," />
          </span>
        ))}
      </span>
      <span className="r2-line">
        {fml}, {label}, {rule}⟩{suffix}
      </span>
    </span>
  );
}

function Tamper({ node, overrides, onChange, onReset }: { node: CodedNode | null; overrides: Overrides; onChange: (p: number[], v: { n?: number; k?: number }) => void; onReset: () => void }) {
  if (!node) {
    return (
      <p className="wb-note">
        <b>Change the code:</b> select a tuple in panel 2 (its <b>⟨</b>) or a position below, then change its rule number or label and see what the decoder and the checker make of the new number.
        {overrides.size > 0 && (
          <>
            {' '}
            <button className="chip-btn" onClick={onReset}>
              restore the original code
            </button>
          </>
        )}
      </p>
    );
  }
  const o = overrides.get(pathKey(node.path));
  const n = o?.n ?? node.n;
  const k = o?.k ?? node.k;
  return (
    <div className="r2-row" role="group" aria-label={`Change the tuple at position ${posText(node.path)}`}>
      <span>
        Position <b>{posText(node.path)}</b> ({node.kind}):
      </span>
      {node.kind === 'inference' && (
        <label>
          rule <Tex tex="k" />
          <select className="r2-input" value={k} onChange={(e) => onChange(node.path, { k: Number(e.target.value) })}>
            {Array.from({ length: 17 }, (_, i) => i + 1).map((x) => (
              <option key={x} value={x}>
                {x} {RULE_OF_NUMBER[x] ? RULE_NAMES[RULE_OF_NUMBER[x]] : '(no rule)'}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        label <Tex tex="n" />
        <input className="r2-input num" type="number" min={0} max={99} value={n} onChange={(e) => onChange(node.path, { n: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} />
      </label>
      {overrides.size > 0 && (
        <button className="chip-btn" onClick={onReset}>
          restore the original code
        </button>
      )}
    </div>
  );
}

function bfs(d: Deriv): Deriv[] {
  const out: Deriv[] = [];
  let level = [d];
  while (level.length) {
    out.push(...level);
    level = level.flatMap((x) => x.premises);
  }
  return out;
}

function BookFunctions({ code, root, dchk, decoded, fromQ, deriv, sel, setSel }: { code: Nat; root: CodedNode; dchk: CheckResult | null; decoded: Deriv | null; fromQ: boolean; deriv: Deriv; sel: string | null; setSel: (s: string | null) => void }) {
  const subs = useMemo(() => subtreeSeq(code), [code]);
  const nodes = useMemo(() => codedNodes(root), [root]);
  const dnodes = useMemo(() => (decoded ? bfs(decoded) : []), [decoded]);
  const occ = useMemo(() => assumptionOccurrences(code), [code]);
  const prfRes = useMemo(() => (fromQ ? prf(code, godelNumber(deriv.concl), Q()) : null), [code, deriv, fromQ]);
  const indexOf = (c: Nat) => subs.findIndex((s) => s === c || natEq(s, c) === 'equal');
  return (
    <Panel n={4} title="The book’s functions on the code" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="\mathrm{SubtreeSeq}(d)" /> lists the codes of all sub-derivations (the book’s version may repeat some; here each is listed once, level by level). <Tex tex="\mathrm{Correct}" /> is whether the last inference of that sub-derivation is a correct application of its rule — here decided by the checker on the decoded tree; <Ref k="inc:art:pnd:prop:followsby" /> shows it is primitive recursive.
      </p>
      <div className="r2-table-wrap">
        <table className="r2-table">
          <caption className="sr-only">SubtreeSeq of the code</caption>
          <thead>
            <tr>
              <th scope="col">i</th>
              <th scope="col">position</th>
              <th scope="col">EndFmla</th>
              <th scope="col">DischargeLabel</th>
              <th scope="col">LastRule</th>
              <th scope="col">Correct</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((c, i) => {
              const nd = nodes[i];
              const st = dnodes[i] ? dchk?.steps.get(dnodes[i].id) : undefined;
              const lr = lastRule(c);
              return (
                <tr key={i} className={nd && pathKey(nd.path) === sel ? 'r2-sel' : ''}>
                  <td>{i}</td>
                  <td>
                    {nd && (
                      <button className="linklike" onClick={() => setSel(pathKey(nd.path))}>
                        {posText(nd.path)}
                      </button>
                    )}
                  </td>
                  <td>{nd && <Tex tex={formulaTex(nd.formula)} />}</td>
                  <td className="num">{dischargeLabel(c) ?? '?'}</td>
                  <td className="num">{lr === null ? '?' : lr === 0 ? '0 (assumption)' : `${lr}${RULE_OF_NUMBER[lr] ? ` ${RULE_NAMES[RULE_OF_NUMBER[lr]]}` : ''}`}</td>
                  <td>{st ? <Mark ok={st.ok} /> : <span className="r2-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        <Tex tex="\mathrm{Assum}(x, d, n)" />: the assumption <Tex tex="\langle 0, x, n\rangle" /> occurs in <Tex tex="d" />. <Tex tex="\mathrm{OpenAssum}(z, d)" /> (<Ref k="inc:art:pnd:prop:openassum" />): along the path from <Tex tex="d" /> down to some occurrence <Tex tex="\langle 0, z, n\rangle" />, no sub-derivation ends in an inference with discharge label <Tex tex="n" />. Computed on the code itself, without the checker:
      </p>
      <div className="r2-table-wrap">
        <table className="r2-table">
          <caption className="sr-only">Assumption occurrences</caption>
          <thead>
            <tr>
              <th scope="col">assumption</th>
              <th scope="col">
                <Tex tex="n" />
              </th>
              <th scope="col">path (SubtreeSeq indices)</th>
              <th scope="col">status</th>
            </tr>
          </thead>
          <tbody>
            {occ.map((o, i) => {
              const f = decodeFormula(o.x, { expect: 'formula' });
              return (
                <tr key={i}>
                  <td>{f.ok ? <Tex tex={formulaTex(f.node as Formula)} /> : '?'}</td>
                  <td className="num">{o.n}</td>
                  <td className="num">{o.chain.map(indexOf).join(' → ')}</td>
                  <td>{o.open ? <span className="r2-badge info">undischarged</span> : <span className="r2-muted">discharged at {indexOf(o.dischargedAt!)}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {prfRes && (
        <>
          <p className="wb-note">
            <Tex tex="\mathrm{Prf}_{\mathbf Q}(x, y)" /> (<Ref k="inc:art:pnd:prop:prf-prim-rec" />) for <Tex tex="x" /> this code and <Tex tex="y" /> the Gödel number of <Tex tex={formulaTex(deriv.concl)} />:
          </p>
          <ul className="r2-small sans" style={{ margin: '4px 0', paddingLeft: 20 }}>
            <li>
              <Tex tex="\mathrm{Deriv}(x)" />: every sub-derivation is correct <Mark ok={prfRes.deriv} />
            </li>
            <li>
              <Tex tex="\mathrm{EndFmla}(x) = y" /> <Mark ok={prfRes.endFormula} />
            </li>
            <li>
              every undischarged assumption is an axiom of Q ({prfRes.open.map((o) => o.axiom ?? '?').join(', ') || 'none'}) <Mark ok={prfRes.openInGamma} />
            </li>
          </ul>
        </>
      )}
      <NotAProof>
        These are computations on one code. The book shows that <Tex tex="\mathrm{Deriv}" /> and <Tex tex="\mathrm{Prf}_\Gamma" /> are primitive recursive for every derivation (<Ref k="inc:art:pnd:prop:deriv" />); the point here is to see what the definitions do, not to prove them.
      </NotAProof>
    </Panel>
  );
}


/** The book's example, for the reader's A and B: its code, decoded back and checked (for Formal mode). */
export function BookExampleCode() {
  const { ab, aErr, bErr, built } = useCodedExample('book');
  const [sel, setSel] = useState<string | null>(null);
  const back = useMemo(() => (built?.enc.ok ? decodeDerivation(built.enc.root.code) : null), [built]);
  const ok = !!back?.ok && check(back.deriv).valid;
  if (aErr || bErr) return <p className="r2-err">Your A or B (set in Explore mode) is not a sentence.</p>;
  if (!built || !built.enc.ok) return null;
  return (
    <div>
      <p className="wb-note">
        With <Tex tex="A" /> = <code>{ab.A}</code> and <Tex tex="B" /> = <code>{ab.B}</code> (you can change them in Explore mode):
      </p>
      <div className="r2-code">
        <TupleView node={built.enc.root} overrides={new Map()} sel={sel} onSelect={setSel} />
      </div>
      <p className="wb-note">
        The whole code has {sizeOf(built.enc.root.code, built.enc.root.formulaCode)}. Decoded back and checked by the natural deduction checker: <Mark ok={ok} />
      </p>
    </div>
  );
}
