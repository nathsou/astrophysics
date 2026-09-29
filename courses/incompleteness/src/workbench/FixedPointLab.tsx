// The fixed-point lemma, constructed step by step for a formula B(x) of your choice.

import { useMemo, useState, type ReactNode } from 'react';
import { bStore, useParsedFormula } from '../content/objects';
import { fixedPoint, validateB, type FixedPointConstruction } from '../engine/fixedpoint/fixedpoint';
import { analyze } from '../engine/syntax/analysis';
import { freeVars } from '../engine/syntax/ops';
import { formatMagnitude, magnitude, natEq } from '../engine/numbers/nat';
import type { Formula } from '../engine/syntax/ast';
import { FormulaView } from '../ui/FormulaView';
import { NatView } from '../ui/NatView';
import { ProofDebugger } from '../ui/ProofDebugger';
import { Stepper } from '../ui/Stepper';
import { Prov, NotAProof } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { Ref } from '../formal/FormalText';
import { inspect } from '../ui/store';

const STAGES = ['B(x)', 'E(x)', '#E(x)#', '⌜E(x)⌝', 'A', 'diag', 'Q ⊢ A ↔ B(⌜A⌝)'];

export function useFixedPoint(B: Formula | null): FixedPointConstruction | { error: string } | null {
  return useMemo(() => {
    if (!B) return null;
    const err = validateB(B);
    if (err) return { error: err };
    return fixedPoint(B);
  }, [B]);
}

/**
 * The construction, one stage at a time, starting from B(x) itself. B(x) is the section's object:
 * it is edited in the object bar above, not here.
 */
export function FixedPointLab({ showDerivation = true }: { showDerivation?: boolean }) {
  const [, , parsed] = useParsedFormula(bStore);
  const B = parsed.ok ? parsed.value : null;
  const c = useFixedPoint(B);
  const [stage, setStage] = useState(0);
  return (
    <div className="workbench fixed-point">
      <LaneLegend />
      {!parsed.ok && <p className="fi-error">B(x) does not parse: {parsed.error}. Edit it in the bar above.</p>}
      {c && 'error' in c && <p className="fi-error">{c.error}. Edit B(x) in the bar above.</p>}
      {c && !('error' in c) && (
        <>
          <Stepper
            step={stage}
            count={STAGES.length}
            onStep={setStage}
            label="construction"
            describe={(i) => <>Stage {i + 1}: {STAGE_TEXT[i]}</>}
          />
          <Stages c={c} upTo={stage} showDerivation={showDerivation} />
        </>
      )}
    </div>
  );
}

const STAGE_TEXT: ReactNode[] = [
  'the formula B(x) you chose.',
  'the formula E(x) = ∃y (D_diag(x, y) ∧ B(y)): “B holds of diag(x)”, the Gödel number of the diagonalization of the formula with Gödel number x.',
  'the Gödel number of E(x): a natural number, outside the language.',
  'the numeral for that number: a term of arithmetic that denotes it.',
  'the sentence A = E(⌜E(x)⌝): the numeral put in place of x.',
  'diag, computed on the number: decode, substitute, encode.',
  'the derivation of A ↔ B(⌜A⌝) in Q, checked.',
];

export function LaneLegend() {
  return (
    <div className="lanes-legend sans" aria-label="Kinds of object">
      <span className="lane-chip formula">formula — an expression of the language</span>
      <span className="lane-chip number">number — a natural number we reason about</span>
      <span className="lane-chip numeral">numeral — a term of the language denoting a number</span>
    </div>
  );
}

function Lane({ kind, stage, title, children, active, tag }: { kind: 'formula' | 'number' | 'numeral' | 'check'; stage: number; title: ReactNode; children: ReactNode; active: boolean; tag?: string }) {
  return (
    <section className={`fp-stage lane-${kind} ${active ? 'active' : ''}`} aria-current={active ? 'step' : undefined}>
      <header>
        <span className="fp-n">{stage}</span>
        <span className="fp-title">{title}</span>
        <span className={`lane-chip ${kind}`}>{tag ?? kind}</span>
      </header>
      <div className="fp-body">{children}</div>
    </section>
  );
}

function Stages({ c, upTo, showDerivation }: { c: FixedPointConstruction; upTo: number; showDerivation: boolean }) {
  const aB = useMemo(() => analyze(c.B), [c]);
  const aE = useMemo(() => analyze(c.E), [c]);
  const aA = useMemo(() => analyze(c.fixed), [c]);
  const lower = formatMagnitude(magnitude(c.encE.number, { lowerBound: true }));
  const lowerA = formatMagnitude(magnitude(c.encA.number, { lowerBound: true }));
  return (
    <div className="fp-stages">
      <Lane kind="formula" stage={1} title={<>The formula <Tex tex="B(x)" /></>} active={upTo === 0}>
        <FormulaView node={c.B} analysis={aB} />
      </Lane>
      {upTo >= 1 && (
        <Lane kind="formula" stage={2} title={<>The formula <Tex tex="E(x) = \exists y\,(D_{\mathrm{diag}}(x, y) \land B(y))" /></>} active={upTo === 1}>
          <FormulaView node={c.E} analysis={aE} />
          <p className="fp-note">
            <Tex tex="D_{\mathrm{diag}}(x, y)" /> represents in <Tex tex="\mathbf{Q}" /> the primitive recursive function <Tex tex="\mathrm{diag}" />, which sends the Gödel number of a
            formula <Tex tex="F(x)" /> to the Gödel number of <Tex tex="F(\ulcorner F(x) \urcorner)" />. It is a definite formula of arithmetic, far too long to write out; it appears
            here by name.
          </p>
        </Lane>
      )}
      {upTo >= 2 && (
        <Lane kind="number" stage={3} title={<>Its Gödel number <Tex tex="\#E(x)\#" /></>} active={upTo === 2}>
          <NatView n={c.encE.number} maxItems={8} expandable={false} />
          <p className="fp-note">
            A natural number with at least {lower}. It is not an expression and cannot occur inside a formula. Exact, but never expanded.
          </p>
        </Lane>
      )}
      {upTo >= 3 && (
        <Lane kind="numeral" stage={4} title={<>The numeral <Tex tex="\ulcorner E(x) \urcorner = \overline{\#E(x)\#}" /></>} active={upTo === 3}>
          <p>
            <FormulaView node={c.quoteE} label="numeral" /> <Tex tex={`= 0\\underbrace{{}'\\,{}'\\cdots{}'}_{\\#E(x)\\#\\text{ primes}}`} />
          </p>
          <p className="fp-note">
            A <b>term</b> of the language of arithmetic that denotes the number of stage 3. This is how arithmetic can “mention” a formula: not by containing it, but by
            containing a name for its Gödel number.
          </p>
        </Lane>
      )}
      {upTo >= 4 && (
        <Lane kind="formula" stage={5} title={<>The sentence <Tex tex="A = E(\ulcorner E(x) \urcorner)" /></>} active={upTo === 4}>
          <FormulaView node={c.fixed} analysis={aA} />
          <p className="fp-note">
            The <b>diagonalization</b> of <Tex tex="E(x)" />: the numeral of its own Gödel number substituted for <Tex tex="x" />. {freeVars(c.fixed).size === 0 ? 'A is a sentence.' : ''} Its
            own Gödel number <Tex tex="\#A\#" /> has {lowerA}.
          </p>
        </Lane>
      )}
      {upTo >= 5 && (
        <Lane kind="check" tag="computation" stage={6} title={<><Tex tex="\mathrm{diag}(\#E(x)\#) = \#A\#" /></>} active={upTo === 5}>
          {c.diagCheck.error ? (
            <p className="error-box">{c.diagCheck.error}</p>
          ) : (
            <>
              <ol className="fp-diag">
                <li>
                  decode the number <Tex tex="\#E(x)\#" /> back into a formula: <FormulaView node={c.diagCheck.decoded!} />
                </li>
                <li>
                  substitute the numeral <Tex tex="\overline{\#E(x)\#}" /> for <Tex tex="x" /> and encode again;
                </li>
                <li>
                  compare with <Tex tex="\#A\#" />:{' '}
                  {c.diagCheck.agrees === 'equal' ? <Prov kind="computed">equal — compared exactly</Prov> : <Prov kind="failed">{c.diagCheck.agrees}</Prov>}
                </li>
              </ol>
              <p className="fp-note">
                So the representing formula <Tex tex="D_{\mathrm{diag}}" /> gives, in <Tex tex="\mathbf{Q}" />, the two facts the proof needs, <Ref k="inc:inp:fix:repdiag1" /> and{' '}
                <Ref k="inc:inp:fix:repdiag2" />.
              </p>
            </>
          )}
        </Lane>
      )}
      {upTo >= 6 && showDerivation && (
        <Lane kind="check" tag="checked derivation" stage={7} title={<><Tex tex="\mathbf{Q} \vdash A \leftrightarrow B(\ulcorner A \urcorner)" /></>} active={upTo === 6}>
          <FixedPointDerivation c={c} />
        </Lane>
      )}
    </div>
  );
}

export function FixedPointDerivation({ c }: { c: FixedPointConstruction }) {
  return (
    <>
      <p className="fp-note">
        The proof of <Ref k="inc:inp:fix:lem:fixed-point" />, for your <Tex tex="B" />, as a complete natural deduction derivation. Its only undischarged premises are the two
        facts about <Tex tex="D_{\mathrm{diag}}" />; no axiom of Q is needed beyond those.
      </p>
      <ProofDebugger
        deriv={c.derivation}
        check={c.checked}
        title="A ↔ B(⌜A⌝)"
        hypotheses={{
          repdiag1: (
            <>
              Clause (a) of representability for diag at <Tex tex="\#E(x)\#" /> — equation <Ref k="inc:inp:fix:repdiag1" /> in the text.
            </>
          ),
          repdiag2: (
            <>
              Clause (b) of representability for diag at <Tex tex="\#E(x)\#" /> — equation <Ref k="inc:inp:fix:repdiag2" /> in the text.
            </>
          ),
        }}
      />
      <NotAProof>
        This derivation is for your B(x). <Ref k="inc:inp:fix:lem:fixed-point" /> is the general statement: the same construction works for every B(x) — which is exactly what
        the uniform shape of this derivation suggests, and what the proof in the text shows.
      </NotAProof>
    </>
  );
}

/** Formula, number and numeral side by side. */
export function ThreeThings() {
  const [, , parsed] = useParsedFormula(bStore);
  const c = useFixedPoint(parsed.ok ? parsed.value : null);
  if (!c || 'error' in c) return null;
  return (
    <div className="three-things-wrap">
    <table className="three-things sans">
      <thead>
        <tr>
          <th />
          <th className="formula">the formula</th>
          <th className="number">its Gödel number</th>
          <th className="numeral">its numeral</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">written</th>
          <td>
            <Tex tex="E(x)" />
          </td>
          <td>
            <Tex tex="\#E(x)\#" />
          </td>
          <td>
            <Tex tex="\ulcorner E(x) \urcorner" />
          </td>
        </tr>
        <tr>
          <th scope="row">what it is</th>
          <td>a string of symbols of the language</td>
          <td>a natural number</td>
          <td>a term: 0 followed by that many primes</td>
        </tr>
        <tr>
          <th scope="row">lives in</th>
          <td>the object language</td>
          <td>our reasoning about the language</td>
          <td>the object language</td>
        </tr>
        <tr>
          <th scope="row">can occur in a formula?</th>
          <td>as a subformula, not as a term</td>
          <td>no — only a name for it can</td>
          <td>yes, wherever a term can</td>
        </tr>
        <tr>
          <th scope="row">here</th>
          <td>
            <button className="linklike" onClick={() => inspect({ key: 'E', kicker: 'The formula', title: <Tex tex="E(x)" />, body: <FormulaView node={c.E} /> }, true)}>
              show
            </button>
          </td>
          <td>{formatMagnitude(magnitude(c.encE.number, { lowerBound: true }))} (at least)</td>
          <td>
            <Tex tex="3 \cdot \#E(x)\# + 1" /> symbols in official notation, <Tex tex="{}'({}'(\cdots 0 \cdots))" />
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  );
}

export { natEq };
