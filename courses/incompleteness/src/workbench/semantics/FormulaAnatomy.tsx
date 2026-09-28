// The anatomy of a formula: its syntax tree, which clause of the inductive definition of terms
// and formulas builds each part, the official symbols used, and the free variables of every
// subformula (sections "First-Order Languages", "Terms and Formulas", "Free Variables and Sentences").

import { useMemo } from 'react';
import type { Formula, Node } from '../../engine/syntax/ast';
import { children, isTerm } from '../../engine/syntax/ast';
import { tryParseFormula } from '../../engine/syntax/parse';
import { freeVars } from '../../engine/syntax/ops';
import { nodeText } from '../../engine/syntax/print';
import { constName, fnName, predName, varName, sub, sup } from '../../engine/syntax/language';
import { ABBREVIATIONS } from '../../content/objects';
import { FormulaInput } from '../../ui/FormulaInput';
import { FormulaView, highlightNode, clearHighlight, useAnalysis } from '../../ui/FormulaView';
import { SyntaxTree } from '../../ui/SyntaxTree';
import { Prov } from '../../ui/Prov';
import { persistedStore, useStore } from '../../ui/store';
import { Panel } from '../coding';
import './sem.css';

const store = persistedStore('ic.sem.anatomy', '∀x (R(x, y) → ∃y (R(y, z) ∨ x = f(y)))');

const EXAMPLES = [
  { label: 'the book’s ∃v₀ A²₀(v₀, v₁) (as ∃x R(x, y))', value: '∃x R(x, y)' },
  { label: 'the book’s scope example', value: '∀x (P(x) → R(x, y)) → ∃y (S(x, y) ∨ ∀x ¬Q(x))' },
  { label: 'a sentence of arithmetic', value: '∀x (x = 0 ∨ ∃y x = y′)' },
  { label: 'free and bound occurrences of x', value: 'x = 0 ∧ ∀x x = x' },
  { label: 'defined symbols ↔ and ⊤', value: '⊤ ↔ ∀x x = x' },
];

function clause(n: Node): string {
  switch (n.k) {
    case 'var':
      return 'term: a variable';
    case 'const':
      return 'term: a constant symbol';
    case 'numeral':
      return 'term: a numeral 0′…′ (successor applied to 0)';
    case 'app':
      return `term: f(t₁, …, tₙ) for the ${n.arity}-place function symbol ${fnName(n.arity, n.index)}`;
    case 'bot':
      return 'atomic formula: ⊥';
    case 'top':
      return 'defined: ⊤ abbreviates ¬⊥';
    case 'pred':
      return `atomic formula: R(t₁, …, tₙ) for the ${n.arity}-place predicate symbol ${predName(n.arity, n.index)}`;
    case 'eq':
      return 'atomic formula: =(t₁, t₂)';
    case 'abbr':
      return 'a named formula (an abbreviation)';
    case 'not':
      return 'formula: ¬A';
    case 'and':
      return 'formula: (A ∧ B)';
    case 'or':
      return 'formula: (A ∨ B)';
    case 'imp':
      return 'formula: (A → B)';
    case 'iff':
      return 'defined: (A ↔ B) abbreviates ((A → B) ∧ (B → A))';
    case 'forall':
      return `formula: ∀${varName(n.v.index)} A`;
    case 'exists':
      return `formula: ∃${varName(n.v.index)} A`;
  }
}

function official(n: Node): string | null {
  switch (n.k) {
    case 'var':
      return `v${sub(n.index)}`;
    case 'const':
      return `c${sub(n.index)}`;
    case 'app':
      return `f${sup(n.arity)}${sub(n.index)}`;
    case 'pred':
      return `P${sup(n.arity)}${sub(n.index)}`;
    default:
      return null;
  }
}

export function FormulaAnatomy({ focus = 'all' }: { focus?: 'all' | 'free' | 'symbols' }) {
  const text = useStore(store);
  const parsed = useMemo(() => tryParseFormula(text, { abbreviations: ABBREVIATIONS }), [text]);
  const F: Formula | null = parsed.ok ? parsed.value : null;
  const a = useAnalysis(F);
  const nodes = useMemo(() => {
    if (!F) return [];
    const out: { n: Node; depth: number }[] = [];
    const go = (n: Node, d: number) => {
      if (n.k === 'var' && out.length && (out[out.length - 1].n.k === 'forall' || out[out.length - 1].n.k === 'exists') && (out[out.length - 1].n as Formula & { v: Node }).v === n) return;
      out.push({ n, depth: d });
      for (const c of children(n)) go(c, d + 1);
    };
    go(F, 0);
    return out;
  }, [F]);
  const symbols = useMemo(() => {
    const m = new Map<string, { shown: string; official: string; kind: string }>();
    for (const { n } of nodes) {
      const o = official(n);
      if (!o) continue;
      const shown = n.k === 'var' ? varName(n.index) : n.k === 'const' ? constName(n.index) : n.k === 'app' ? fnName(n.arity, n.index) : n.k === 'pred' ? predName(n.arity, n.index) : '';
      m.set(o, { shown, official: o, kind: n.k === 'var' ? 'variable' : n.k === 'const' ? 'constant symbol' : n.k === 'app' ? `${n.arity}-place function symbol` : `${(n as { arity: number }).arity}-place predicate symbol` });
    }
    return [...m.values()];
  }, [nodes]);
  const fv = F ? [...freeVars(F)] : [];
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="A formula" prov={<Prov kind="computed" />}>
        <FormulaInput value={text} onChange={store.set} parsed={parsed} label="A" examples={EXAMPLES} />
        {F && a && (
          <>
            <div className="wb-formula">
              <FormulaView node={F} analysis={a} />
            </div>
            <p className="wb-note" aria-live="polite">
              {fv.length === 0 ? (
                <>
                  <b>A sentence:</b> no variable occurs free.
                </>
              ) : (
                <>
                  <b>Not a sentence:</b> {fv.map(varName).join(', ')} {fv.length === 1 ? 'occurs' : 'occur'} free. Hover a variable to see whether that occurrence is free or which quantifier binds it.
                </>
              )}
            </p>
          </>
        )}
      </Panel>
      {F && a && focus !== 'free' && (
        <Panel n={2} title="Its syntax tree" prov={<Prov kind="computed" />}>
          <div className="sem-scroll sem-tree">
            <SyntaxTree node={F} analysis={a} />
          </div>
        </Panel>
      )}
      {F && a && (
        <Panel n={3} title={focus === 'free' ? 'Free variables of each subformula' : 'How it is built, part by part'} prov={<Prov kind="computed" />}>
          <div className="sem-scroll">
            <table className="sem-compare sem-anatomy">
              <thead>
                <tr>
                  <th scope="col">part</th>
                  <th scope="col">clause of the definition</th>
                  <th scope="col">free variables</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(({ n, depth }) => {
                  const f = freeVars(n);
                  return (
                    <tr key={n.id} onMouseEnter={() => highlightNode(a, n.id)} onMouseLeave={clearHighlight}>
                      <td className="f" style={{ paddingLeft: 8 + depth * 12 }}>
                        <span data-n={n.id}>{nodeText(n)}</span>
                      </td>
                      <td className="small sans">{clause(n)}</td>
                      <td className="f">{isTerm(n) && n.k !== 'var' && f.size === 0 ? '— (closed term)' : f.size === 0 ? (isTerm(n) ? '' : '— (sentence)') : [...f].map(varName).join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {F && focus !== 'free' && symbols.length > 0 && (
        <Panel n={4} title="Its non-logical symbols and variables, officially" prov={<Prov kind="computed" />}>
          <p className="wb-note">In this edition the conventional names are aliases for official symbols (the book writes A for predicate symbols; this edition writes P): &lt; is P²₀, 0 is c₀, ′ is f¹₀, + is f²₀, × is f²₁; the letters x, y, z, u, w are v₀ … v₄.</p>
          <div className="sem-map">
            {symbols.map((s) => (
              <span key={s.official}>
                {s.shown} = {s.official} ({s.kind})
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
