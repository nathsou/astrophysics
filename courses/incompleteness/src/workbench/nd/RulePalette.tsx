// The rules of natural deduction as the book displays them (sections Propositional Rules,
// Quantifier Rules, Derivations with Identity), with the checker's statement of each rule
// (RULE_SCHEMA). As a palette, a card picks the rule to apply.

import type { ReactNode } from 'react';
import { RULE_NAMES, RULE_SCHEMA, type Rule } from '../../engine/proof/nd';
import { Tex } from '../../ui/Tex';
import './nd.css';

type Prem = string | { top: string; bottom: string };
interface Schema {
  premises: Prem[];
  concl: string;
  /** the inference discharges assumptions labelled n */
  n?: boolean;
}

/** The book's schemas (as in its `defish` displays). */
export const BOOK_SCHEMAS: Partial<Record<Rule, Schema[]>> = {
  andI: [{ premises: ['A', 'B'], concl: 'A \\land B' }],
  andE: [{ premises: ['A \\land B'], concl: 'A' }, { premises: ['A \\land B'], concl: 'B' }],
  orI: [{ premises: ['A'], concl: 'A \\lor B' }, { premises: ['B'], concl: 'A \\lor B' }],
  orE: [{ premises: ['A \\lor B', { top: '[A]^n', bottom: 'C' }, { top: '[B]^n', bottom: 'C' }], concl: 'C', n: true }],
  impI: [{ premises: [{ top: '[A]^n', bottom: 'B' }], concl: 'A \\rightarrow B', n: true }],
  impE: [{ premises: ['A \\rightarrow B', 'A'], concl: 'B' }],
  notI: [{ premises: [{ top: '[A]^n', bottom: '\\bot' }], concl: '\\lnot A', n: true }],
  notE: [{ premises: ['\\lnot A', 'A'], concl: '\\bot' }],
  botI: [{ premises: ['\\bot'], concl: 'A' }],
  botC: [{ premises: [{ top: '[\\lnot A]^n', bottom: '\\bot' }], concl: 'A', n: true }],
  allI: [{ premises: ['A(a)'], concl: '\\forall x\\, A(x)' }],
  allE: [{ premises: ['\\forall x\\, A(x)'], concl: 'A(t)' }],
  exI: [{ premises: ['A(t)'], concl: '\\exists x\\, A(x)' }],
  exE: [{ premises: ['\\exists x\\, A(x)', { top: '[A(a)]^n', bottom: 'C' }], concl: 'C', n: true }],
  eqI: [{ premises: [], concl: 't = t' }],
  eqE: [{ premises: ['t_1 = t_2', 'A(t_1)'], concl: 'A(t_2)' }, { premises: ['t_1 = t_2', 'A(t_2)'], concl: 'A(t_1)' }],
};

export const PALETTE_RULES: Rule[] = ['andI', 'andE', 'orI', 'orE', 'impI', 'impE', 'notI', 'notE', 'botI', 'botC', 'allI', 'allE', 'exI', 'exE', 'eqI', 'eqE'];

export function SchemaView({ s, rule, showName = false }: { s: Schema; rule: Rule; showName?: boolean }) {
  return (
    <div className="ndb-node">
      {s.premises.length > 0 && (
        <div className="ndb-prem">
          {s.premises.map((p, i) =>
            typeof p === 'string' ? (
              <Tex key={i} tex={p} />
            ) : (
              <span key={i} className="ndb-deduce">
                <Tex tex={p.top} />
                <span className="dots" aria-hidden="true">
                  ⋮
                </span>
                <Tex tex={p.bottom} />
              </span>
            ),
          )}
        </div>
      )}
      <div className="ndb-concl line">
        {s.n && <span className="ndb-label">n</span>}
        <Tex tex={s.concl} />
        {showName && <span className="ndb-rule">{RULE_NAMES[rule]}</span>}
      </div>
    </div>
  );
}

export function RuleCard({ rule, onPick, picked, fits, dim, extra }: { rule: Rule; onPick?: (r: Rule) => void; picked?: boolean; fits?: boolean; dim?: boolean; extra?: ReactNode }) {
  const body = (
    <>
      <span className="ndb-rulecard-name">
        <span>{RULE_NAMES[rule]}</span>
        {fits && <span className="fit">fits the goal</span>}
      </span>
      <span className="ndb-schema" aria-hidden={onPick ? true : undefined}>
        {(BOOK_SCHEMAS[rule] ?? []).map((s, i) => (
          <SchemaView key={i} s={s} rule={rule} />
        ))}
      </span>
      {extra}
    </>
  );
  if (!onPick)
    return (
      <div className="ndb-rulecard">
        {body}
        <span className="ndb-schema-text">{RULE_SCHEMA[rule]}</span>
      </div>
    );
  return (
    <button type="button" className={`ndb-rulecard ${fits ? 'fits' : ''} ${dim ? 'dim' : ''}`} aria-pressed={!!picked} onClick={() => onPick(rule)} title={RULE_SCHEMA[rule]} aria-label={`${RULE_NAMES[rule]}: ${RULE_SCHEMA[rule]}${fits ? ' (fits the goal)' : ''}`}>
      {body}
    </button>
  );
}

/** The whole set of rules, with the schemas as displayed in the book and as the checker states them. */
export function RulePalette({ rules = PALETTE_RULES, onPick, picked, fits }: { rules?: Rule[]; onPick?: (r: Rule) => void; picked?: Rule | null; fits?: (r: Rule) => boolean }) {
  return (
    <div className="ndb ndb-palette" role={onPick ? 'group' : undefined} aria-label={onPick ? 'Rules' : undefined}>
      {rules.map((r) => (
        <RuleCard key={r} rule={r} onPick={onPick} picked={picked === r} fits={fits?.(r)} />
      ))}
    </div>
  );
}
