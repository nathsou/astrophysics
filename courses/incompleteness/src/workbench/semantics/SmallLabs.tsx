// Smaller workbenches: reducts and expansions, the values of numerals, x-variants, and
// extensionality with the substitution lemma.

import { useMemo, useState } from 'react';
import type { Formula, Term } from '../../engine/syntax/ast';
import { tryParseFormula, tryParseTerm } from '../../engine/syntax/parse';
import { formulaText, termText } from '../../engine/syntax/print';
import { freeVars } from '../../engine/syntax/ops';
import { subst, substitute } from '../../engine/syntax/subst';
import { varIndex } from '../../engine/syntax/language';
import { reduct, expandWithRelation } from '../../engine/semantics/iso';
import { evaluateTerm, missingSymbols, satisfies, trueIn } from '../../engine/semantics/satisfaction';
import { numeralIn, showElem, type Elem, type Structure, GENERIC, makeStructure } from '../../engine/semantics/structure';
import { variant, xVariants, type Assignment } from '../../engine/semantics/assignment';
import { bookSatisfactionExample } from '../../engine/semantics/examples';
import { evaluateTermSearch, type IElem } from '../../engine/semantics/infinite';
import * as A from '../../engine/syntax/ast';
import { lit } from '../../engine/numbers/nat';
import { FormulaInput } from '../../ui/FormulaInput';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { FiniteTables, StructurePicker, StructureView } from './StructurePicker';
import { TruthBadge } from './TraceTree';
import { resolve, sub, type StructureChoice } from './model';
import './sem.css';

// ------------------------------------------------------------------ reducts and expansions

const RED_SENTENCES = ['∀x ∃y y′ = x', '∀x ¬x = x′', "∃x x′′ = x", '∀x (x + 0) = x', '∃x (P(x) ∧ P(x′))', '∀x (P(x) → ¬P(x′))'];

export function ReductLab() {
  const [n, setN] = useState(6);
  const [evens, setEvens] = useState<boolean[]>(() => Array.from({ length: 12 }, (_, i) => i % 2 === 0));
  const [text, setText] = useState(RED_SENTENCES.join('\n'));
  const full = useMemo(() => (resolve({ kind: 'mod', n, mode: 'wrap' }) as { kind: 'finite'; M: Structure }).M, [n]);
  const red = useMemo(() => reduct(full, { constants: [0], functions: [[1, 0]] }, 'M'), [full]);
  const exp = useMemo(
    () =>
      expandWithRelation(
        red,
        1,
        GENERIC.P(1).index,
        red.domain.filter((_, i) => evens[i]).map((e) => [e]),
        'Mᴾ',
      ),
    [red, evens],
  );
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const cell = (M: Structure, F: Formula) => {
    const miss = missingSymbols(M, F);
    if (miss.length) return <span className="small muted sans">not a sentence of this language</span>;
    return <TruthBadge t={trueIn(M, F, { trace: false }).truth} />;
  };
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="A structure, a reduct, and an expansion" prov={<Prov kind="computed" />}>
        <label className="sem-inline">
          Start from ℤₙ with n =
          <input type="number" min={2} max={10} value={n} onChange={(e) => setN(Math.max(2, Math.min(10, Number(e.target.value) || 6)))} />
        </label>
        <p className="wb-note">
          The reduct M forgets +, × and &lt; and keeps only 0 and ′. The expansion M<sup>P</sup> adds a 1-place predicate symbol P, interpreted as the set you tick:
        </p>
        <div className="sem-symbols" role="group" aria-label="The set interpreting P">
          {red.domain.map((d, i) => (
            <label key={i} className="sem-check">
              <input type="checkbox" checked={evens[i]} onChange={(e) => setEvens(evens.map((b, j) => (j === i ? e.target.checked : b)))} />
              {showElem(d)}
            </label>
          ))}
        </div>
        <div className="sem-two">
          <div>
            <b className="sans small">ℤ{sub(n)} (0, ′, +, ×, &lt;)</b>
            <FiniteTables M={{ ...full, description: undefined }} compact />
          </div>
          <div>
            <b className="sans small">the expansion M<sup>P</sup> (0, ′, P) of the reduct M (0, ′)</b>
            <FiniteTables M={exp} compact />
          </div>
        </div>
      </Panel>
      <Panel n={2} title="Sentences in the three structures" prov={<Prov kind="computed" />}>
        <textarea className="sem-sentences" aria-label="Sentences, one per line" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="sem-scroll">
          <table className="sem-compare">
            <thead>
              <tr>
                <th scope="col">sentence</th>
                <th scope="col">ℤ{sub(n)}</th>
                <th scope="col">reduct M</th>
                <th scope="col">
                  expansion M<sup>P</sup>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = tryParseFormula(l);
                return (
                  <tr key={i}>
                    <td className="sem-ftext">{l}</td>
                    {p.ok ? (
                      <>
                        <td className="c">{cell(full, p.value)}</td>
                        <td className="c">{cell(red, p.value)}</td>
                        <td className="c">{cell(exp, p.value)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="sem-viol">
                        {p.error}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="wb-note">Whenever a sentence belongs to the smaller language, the structure and its reduct (or expansion) agree on it (<Ref k="mod:bas:red:prop:reduct" />).</p>
        <NotAProof>These rows are instances; the proposition holds for every sentence, by extensionality.</NotAProof>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ values of numerals

/** A numeral n̄, with the bar drawn by CSS (combining overlines sit badly on digits). */
function Numeral({ n }: { n: number | string }) {
  return (
    <span className="sem-numeral">
      {n}
    </span>
  );
}

export function NumeralNames({ initial = { kind: 'search', id: 'K' } as StructureChoice }: { initial?: StructureChoice }) {
  const [choice, setChoice] = useState<StructureChoice>(initial);
  const [N, setN] = useState(10);
  const r = useMemo(() => resolve(choice), [choice]);
  const rows = useMemo(() => {
    const out: { n: number; v: string }[] = [];
    for (let i = 0; i < N; i++) {
      if (r.kind === 'finite') {
        const v = numeralIn(r.M, BigInt(i));
        out.push({ n: i, v: typeof v === 'object' ? '—' : showElem(v) });
      } else if (r.kind === 'search') {
        const t = evaluateTermSearch(r.S, new Map(), i === 0 ? A.zero() : A.numeral(lit(i)));
        out.push({ n: i, v: t.value === null ? '—' : r.S.show(t.value as IElem) });
      }
    }
    return out;
  }, [r, N]);
  const named = new Set(rows.map((x) => x.v));
  const domain = r.kind === 'finite' ? r.M.domain.map(showElem) : r.kind === 'search' ? r.S.enumerate(Math.max(N, 12)).map(r.S.show) : [];
  const unnamed = domain.filter((d) => !named.has(d));
  return (
    <Panel title="Which elements are values of numerals?" prov={<Prov kind="computed" />}>
      <StructurePicker value={choice} onChange={setChoice} scope="arith" />
      <StructureView r={r} compact />
      <label className="sem-inline">
        show the numerals <Numeral n="n" /> for n &lt;
        <input type="number" min={1} max={60} value={N} onChange={(e) => setN(Math.max(1, Math.min(60, Number(e.target.value) || 10)))} />
      </label>
      <p className="sem-map">
        {rows.map((x) => (
          <span key={x.n}>
            Val(<Numeral n={x.n} />) = {x.v}
          </span>
        ))}
      </p>
      <p aria-live="polite">
        {r.kind === 'finite' ? (
          unnamed.length === 0 ? (
            <>Every element of the domain is the value of some numeral.{r.M.domain.length < N ? ' But the values repeat, so different numerals name the same element: the structure is not standard.' : ''}</>
          ) : (
            <>
              Not the value of any numeral: <b>{unnamed.join(', ')}</b> (the values of <Numeral n="n" /> repeat after at most |M| steps, so no later numeral names them either).
            </>
          )
        ) : unnamed.length === 0 ? (
          <>Among the first {domain.length} elements, each is the value of one of these numerals.</>
        ) : (
          <>
            Among the first {domain.length} elements, not the value of <Numeral n="n" /> for n &lt; {N}: <b>{unnamed.slice(0, 8).join(', ')}</b>
            {r.kind === 'search' && (r.S.id === 'K' || r.S.id === 'L' || r.S.id === 'Z') ? ' — and since in this structure the numerals denote 0, 1, 2, … and nothing else, these are the value of no numeral at all: they are non-standard elements.' : '.'}
          </>
        )}
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------------ x-variants

export function VariantsTable() {
  const M = useMemo(() => bookSatisfactionExample(), []);
  const [x, setX] = useState('x');
  const [base, setBase] = useState<Record<string, number>>({ x: 1, y: 1, z: 1 });
  const vars = ['x', 'y', 'z'];
  const s: Assignment<Elem> = new Map(vars.map((v) => [varIndex(v)!, base[v]]));
  const xi = varIndex(x)!;
  const vs = xVariants(M.domain, s, xi);
  return (
    <Panel title="An assignment and its x-variants" prov={<Prov kind="computed" />}>
      <p className="wb-note">In the book’s example |M| = {'{'}1, 2, 3, 4{'}'}. An assignment gives every variable a value; only x, y, z are shown (all others: 1).</p>
      <div className="sem-assign-row">
        {vars.map((v) => (
          <label key={v} className="sem-inline">
            s({v}) =
            <select value={base[v]} onChange={(e) => setBase({ ...base, [v]: Number(e.target.value) })}>
              {M.domain.map((d) => (
                <option key={String(d)} value={d as number}>
                  {showElem(d)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="sem-inline">
          variants for the variable
          <select value={x} onChange={(e) => setX(e.target.value)}>
            {vars.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="sem-scroll">
        <table className="sem-compare">
          <thead>
            <tr>
              <th scope="col">assignment</th>
              {vars.map((v) => (
                <th key={v} scope="col">
                  {v}
                </th>
              ))}
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sem-ftext">s</td>
              {vars.map((v) => (
                <td key={v} className="c">
                  {base[v]}
                </td>
              ))}
              <td />
            </tr>
            {vs.map((t, i) => {
              const same = vars.every((v) => t.get(varIndex(v)!) === s.get(varIndex(v)!));
              return (
                <tr key={i} className={same ? 'differs' : ''}>
                  <td className="sem-ftext">
                    s[{showElem(M.domain[i])}/{x}]
                  </td>
                  {vars.map((v) => (
                    <td key={v} className="c">
                      <span className={v === x ? 'sem-elem' : ''}>{String(t.get(varIndex(v)!))}</span>
                    </td>
                  ))}
                  <td className="small sans">{same ? '= s itself: every assignment is an x-variant of itself' : `differs from s only at ${x}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ extensionality and substitution

export function ExtensionalityLab() {
  const M1 = useMemo(() => bookSatisfactionExample(), []);
  const [bVal, setBVal] = useState(3);
  const M2 = useMemo(
    () =>
      makeStructure({
        name: 'M₂',
        domain: [1, 2, 3, 4],
        constants: { 1: 1, 2: bVal },
        functions: [{ ...GENERIC.f(2), def: (x, y) => ((x as number) + (y as number) <= 3 ? (x as number) + (y as number) : 3) }],
        relations: [{ ...GENERIC.R(2), def: { tuples: [[1, 1], [1, 2], [2, 3], [2, 4]] } }],
      }),
    [bVal],
  );
  const [ftext, setF] = useState('∀x (R(a, x) → ∃y R(x, y))');
  const pf = useMemo(() => tryParseFormula(ftext), [ftext]);
  const s: Assignment<Elem> = new Map([[0, 1], [1, 1], [2, 1]]);
  const usesB = pf.ok && collectConsts(pf.value).has(2);
  // substitution lemma
  const [ttext, setT] = useState('f(x, a)');
  const [t2text, setT2] = useState('f(a, b)');
  const pt = useMemo(() => tryParseTerm(ttext), [ttext]);
  const pt2 = useMemo(() => tryParseTerm(t2text), [t2text]);
  const lemma = useMemo(() => {
    if (!pt.ok || !pt2.ok) return null;
    const t = pt.value;
    const t2 = pt2.value;
    const lhsTerm: Term = subst(t, 0, t2);
    const lhs = evaluateTerm(M1, s, lhsTerm).value;
    const m = evaluateTerm(M1, s, t2).value;
    const rhs = m === null ? null : evaluateTerm(M1, variant(s, 0, m), t).value;
    return { lhsTerm, lhs, m, rhs };
  }, [pt, pt2, M1]);
  const [btext, setB] = useState('∃y R(x, y)');
  const pb = useMemo(() => tryParseFormula(btext), [btext]);
  const formulaLemma = useMemo(() => {
    if (!pb.ok || !pt2.ok) return null;
    const res = substitute(pb.value, 0, pt2.value, 'naive');
    const m = evaluateTerm(M1, s, pt2.value).value;
    if (m === null) return null;
    return { res, lhs: satisfies(M1, s, res.result, { trace: false }).truth, rhs: satisfies(M1, variant(s, 0, m), pb.value, { trace: false }).truth, m, free: res.captures.length === 0 };
  }, [pb, pt2, M1]);
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="Only the symbols that occur matter" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          M₁ is the book’s example. M₂ has the same domain and the same a, f, R — only b is interpreted differently. By extensionality, M₁ and M₂ agree on every formula without b.
        </p>
        <label className="sem-inline">
          b<sup>M₂</sup> =
          <select value={bVal} onChange={(e) => setBVal(Number(e.target.value))}>
            {[1, 2, 3, 4].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          (in M₁, b = 2)
        </label>
        <FormulaInput value={ftext} onChange={setF} parsed={pf} label="A" palette={false} examples={[{ label: 'without b', value: '∀x (R(a, x) → ∃y R(x, y))' }, { label: 'with b', value: '∃x (R(b, x) ∨ R(x, b))' }, { label: 'with b', value: 'R(b, f(a, b))' }]} />
        {pf.ok && (
          <table className="sem-compare">
            <tbody>
              <tr>
                <td>M₁, s ⊨ A?</td>
                <td className="c">
                  <TruthBadge t={satisfies(M1, s, pf.value, { trace: false }).truth} />
                </td>
                <td>M₂, s ⊨ A?</td>
                <td className="c">
                  <TruthBadge t={satisfies(M2, s, pf.value, { trace: false }).truth} />
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="wb-note" aria-live="polite">
          {usesB ? 'A contains b, where the structures differ: extensionality says nothing, and they may disagree.' : 'A does not contain b: the structures agree on every symbol of A, so they must agree on A.'} (s assigns 1 to every variable.)
        </p>
      </Panel>
      <Panel n={2} title="Substituting a term, or changing the assignment" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          The book’s Propositions: Val(t[t′/x])[s] = Val(t)[s[m/x]] where m = Val(t′)[s]; and M, s ⊨ B[t′/x] iff M, s[m/x] ⊨ B (for t′ free for x in B). Here s assigns 1 to every variable.
        </p>
        <div className="subst-row">
          <FormulaInput value={ttext} onChange={setT} parsed={pt} label="term t" palette={false} size="compact" />
          <FormulaInput value={t2text} onChange={setT2} parsed={pt2} label="term t′ for x" palette={false} size="compact" />
          <FormulaInput value={btext} onChange={setB} parsed={pb} label="formula B" palette={false} size="compact" />
        </div>
        {lemma && (
          <p className="sem-line" aria-live="polite">
            t[t′/x] = <span className="sem-ftext">{termText(lemma.lhsTerm)}</span> has value <b className="sem-elem">{String(lemma.lhs)}</b>; m = Val(t′) = <b className="sem-elem">{String(lemma.m)}</b>, and t has value{' '}
            <b className="sem-elem">{String(lemma.rhs)}</b> under s[{String(lemma.m)}/x]. {lemma.lhs === lemma.rhs ? <span className="sem-ok">Equal.</span> : <span className="sem-viol">Different!</span>}
          </p>
        )}
        {formulaLemma && pb.ok && (
          <p className="sem-line">
            B[t′/x] = <span className="sem-ftext">{formulaText(formulaLemma.res.result)}</span>: <TruthBadge t={formulaLemma.lhs} /> and B under s[{String(formulaLemma.m)}/x]: <TruthBadge t={formulaLemma.rhs} />
            {!formulaLemma.free && <span className="sem-viol"> — t′ is not free for x in B (a variable of t′ is captured), so the proposition does not apply.</span>}
            {[...freeVars(pb.value)].includes(0) ? '' : <span className="small muted sans"> (x is not free in B, so both sides just evaluate B.)</span>}
          </p>
        )}
        <NotAProof>One structure, one assignment. Both propositions are proved by induction on t and on A.</NotAProof>
      </Panel>
    </div>
  );
}

function collectConsts(F: Formula): Set<number> {
  const out = new Set<number>();
  A.walk(F, (n) => {
    if (n.k === 'const') out.add(n.index);
  });
  return out;
}

