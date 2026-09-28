// Components available in the MDX content of the Intuition and Explore modes.

import { useMemo, type ReactNode } from 'react';
import { tryParseFormula, tryParseTerm } from '../engine/syntax/parse';
import { ABBREVIATIONS, bStore, formulaStore, useParsedFormula } from '../content/objects';
import { FormulaView } from './FormulaView';
import { Added, NotAProof, Prov, ProvLegend } from './Prov';
import { Tex } from './Tex';
import { Ref } from '../formal/FormalText';
import { useStore } from './store';
import { GodelWorkbench } from '../workbench/GodelWorkbench';
import { SymbolTable } from '../workbench/SymbolTable';
import { NumeralLab } from '../workbench/NumeralLab';
import { SequenceLab } from '../workbench/SequenceLab';
import { SubstitutionLab } from '../workbench/SubstitutionLab';
import { RepresentabilityLab } from '../workbench/RepresentabilityLab';
import { FixedPointLab, ThreeThings, LaneLegend } from '../workbench/FixedPointLab';
import { IncompletenessExplorer } from '../workbench/IncompletenessExplorer';
import { QuineDiagonal } from '../workbench/QuineDiagonal';
import { NumeralLemmas } from '../workbench/NumeralLemmas';
import * as Ex from '../content/exercises';

/** An inline formula or term in the course's plain syntax: <F f="∀x x = x" />. */
export function F({ f, children, term }: { f?: string; children?: ReactNode; term?: boolean }) {
  const src = f ?? String(children);
  const p = useMemo(() => (term ? tryParseTerm(src) : tryParseFormula(src, { abbreviations: ABBREVIATIONS })), [src, term]);
  if (!p.ok) return <code className="tex-error">{src}</code>;
  return <FormulaView node={p.value} />;
}

/** The reader's current formula, live. */
export function YourFormula() {
  const [text, , parsed] = useParsedFormula();
  return parsed.ok ? <FormulaView node={parsed.value} label="your formula" /> : <code>{text}</code>;
}

export function YourB() {
  const [text, , parsed] = useParsedFormula(bStore);
  return parsed.ok ? <FormulaView node={parsed.value} label="B(x)" /> : <code>{text}</code>;
}

/** A button that sets the shared formula. */
export function Try({ formula, B, children }: { formula?: string; B?: string; children?: ReactNode }) {
  const cur = useStore(formula ? formulaStore : bStore);
  const value = formula ?? B ?? '';
  return (
    <button className={`chip-btn try ${cur === value ? 'current' : ''}`} onClick={() => (formula ? formulaStore : bStore).set(value)} title="Use this as your object">
      {children ?? value}
    </button>
  );
}

export function Callout({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <aside className="callout">
      {title && <div className="callout-title">{title}</div>}
      {children}
    </aside>
  );
}

export const mdxComponents = {
  F,
  YourFormula,
  YourB,
  Try,
  Callout,
  Added,
  NotAProof,
  Prov,
  ProvLegend,
  Tex,
  Ref,
  GodelWorkbench,
  SymbolTable,
  NumeralLab,
  SequenceLab,
  SubstitutionLab,
  RepresentabilityLab,
  FixedPointLab,
  ThreeThings,
  LaneLegend,
  IncompletenessExplorer,
  QuineDiagonal,
  NumeralLemmas,
  ...Ex,
};
