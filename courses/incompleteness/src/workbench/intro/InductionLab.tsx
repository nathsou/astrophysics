// The induction schema (section 1.2): build instances, and decide whether a sentence is one.

import { useMemo, useState } from 'react';
import { tryParseFormula } from '../../engine/syntax/parse';
import { formulaEq, freeVars } from '../../engine/syntax/ops';
import { Q } from '../../engine/proof/q';
import { varName } from '../../engine/syntax/language';
import { inductionInstance, recognizeInduction } from '../../engine/syntax/induction';
import { formulaText } from '../../engine/syntax/print';
import { FormulaInput } from '../../ui/FormulaInput';
import { FormulaView } from '../../ui/FormulaView';
import { Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import './intro.css';

const EXAMPLES = [
  { label: 'x + 0 = x', value: 'x + 0 = x' },
  { label: '0 + x = x', value: '0 + x = x' },
  { label: 'x + y = y + x', value: 'x + y = y + x' },
  { label: 'even or odd', value: '∃z (x = z + z ∨ x = (z + z)′)' },
];

const CANDIDATES = [
  { label: 'an instance', value: '(0 + 0 = 0 ∧ ∀x (x + 0 = x → x′ + 0 = x′)) → ∀x x + 0 = x' },
  { label: 'wrong step', value: '(0 + 0 = 0 ∧ ∀x (x + 0 = x → x′ + 0 = x)) → ∀x x + 0 = x' },
  { label: 'unbound parameter', value: '(0 + y = y ∧ ∀x (x + y = y → x′ + y = y)) → ∀x x + y = y' },
  { label: 'with a parameter', value: '∀y ((0 + y = y + 0 ∧ ∀x (x + y = y + x → x′ + y = y + x′)) → ∀x x + y = y + x)' },
  { label: 'an axiom of Q', value: '∀x x + 0 = x' },
];

export function InductionLab() {
  const [src, setSrc] = useState('x + y = y + x');
  const parsed = useMemo(() => tryParseFormula(src), [src]);
  const fv = parsed.ok ? [...freeVars(parsed.value)].sort((a, b) => a - b) : [];
  const [xPick, setX] = useState<number | null>(null);
  const x = xPick !== null && fv.includes(xPick) ? xPick : (fv[0] ?? 0);
  const instance = useMemo(() => (parsed.ok ? inductionInstance(parsed.value, x) : null), [parsed, x]);

  const [cand, setCand] = useState(CANDIDATES[0].value);
  const cp = useMemo(() => tryParseFormula(cand), [cand]);
  const rec = useMemo(() => (cp.ok ? recognizeInduction(cp.value) : null), [cp]);
  // The book's test first compares B with the eight axioms of Q, then tries the induction schema.
  const qName = useMemo(() => (cp.ok ? ([...Q()].find(([, f]) => formulaEq(f, cp.value))?.[0] ?? null) : null), [cp]);
  const [hover, setHover] = useState<number | null>(null);
  const marked = rec && hover !== null ? rec.steps[hover]?.nodes : undefined;

  return (
    <div className="workbench">
      <Panel n={1} title="Build an instance" prov={<Prov kind="computed" />}>
        <FormulaInput value={src} onChange={setSrc} parsed={parsed} label="A formula A" examples={EXAMPLES} />
        {parsed.ok && (
          <>
            <div className="fi-row intro-row">
              <span className="fi-label">induction on</span>
              {fv.length === 0 && <span className="muted small">A has no free variables; the instance is induction on x, vacuously.</span>}
              {fv.map((i) => (
                <button key={i} className={`chip-btn ${i === x ? 'primary' : ''}`} aria-pressed={i === x} onClick={() => setX(i)}>
                  {varName(i)}
                </button>
              ))}
            </div>
            {instance && (
              <div className="wb-formula wide">
                <FormulaView node={instance} label="the induction instance" />
              </div>
            )}
            <p className="wb-note">
              The other free variables become universally quantified parameters in front. Every instance is true in 𝔑 — the book explains why — but that does not make it derivable
              in Q.
            </p>
          </>
        )}
      </Panel>
      <Panel n={2} title="Is it an axiom of PA?" prov={<Prov kind="computed">decided</Prov>}>
        <p className="wb-note">
          PA has infinitely many axioms, but whether a sentence is one of them is decidable. The book describes the test: first compare B with the axioms of Q, then check whether it
          is an instance of the induction schema. Here it is, step by step, for any sentence. Hover or focus a step to see the part of the sentence it looks at.
        </p>
        <FormulaInput value={cand} onChange={setCand} parsed={cp} label="A sentence B" examples={CANDIDATES} palette={false} />
        {cp.ok && rec && (
          <>
            <div className="wb-formula wide">
              <FormulaView node={cp.value} marked={marked} />
            </div>
            <ol className="intro-steps">
              <li className={qName ? 'ok' : 'info'}>
                <span aria-hidden>{qName ? '✓' : '·'}</span> {qName ? `B is the axiom ${qName} of Q.` : 'B is not one of the axioms Q1–Q8 of Q. Next: is it an instance of the induction schema?'}
              </li>
              {qName ? null : rec.steps.map((s, i) => (
                <li key={i} className={s.ok ? 'ok' : 'bad'} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                  <span aria-hidden>{s.ok ? '✓' : '✗'}</span> {s.text}
                </li>
              ))}
            </ol>
            <p className={`intro-verdict ${qName || rec.instance ? 'ok' : 'bad'}`} aria-live="polite">
              {qName ? (
                <>B is an axiom of PA: it is {qName}, one of the axioms of Q.</>
              ) : rec.instance ? (
                <>
                  B is an axiom of PA: an instance of the induction schema, for A = <code>{formulaText(rec.A)}</code>.
                </>
              ) : (
                <>B is not an axiom of PA: it is neither an axiom of Q nor an instance of the induction schema.</>
              )}
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
