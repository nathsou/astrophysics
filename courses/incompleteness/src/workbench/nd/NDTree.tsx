// A natural deduction tree drawn as in the book: premises above a line, the rule to the right,
// the discharge label to the left, labelled assumptions in brackets [A]ⁿ. Goals (sentences not
// yet derived) are dashed boxes. Every sentence is a button: selecting it shows the step.

import type { ReactNode } from 'react';
import type { CheckResult, Deriv } from '../../engine/proof/nd';
import { RULE_NAMES } from '../../engine/proof/nd';
import { constName } from '../../engine/syntax/language';
import { ndTex, ndText } from '../../engine/proof/ndlang';
import { Tex } from '../../ui/Tex';
import './nd.css';

export interface NDTreeProps {
  root: Deriv;
  check?: CheckResult;
  goals?: ReadonlySet<string>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Step numbers (reading order), for accessible names. */
  numbers?: Map<string, number>;
  highlight?: ReadonlySet<string>;
  small?: boolean;
  label?: string;
}

export function ruleShort(d: Deriv): string {
  const base = RULE_NAMES[d.rule];
  if ((d.rule === 'allI' || d.rule === 'exE') && d.eigen !== undefined) return `${base} (${constName(d.eigen)})`;
  return base;
}

export function leafTex(d: Deriv): string {
  const t = ndTex(d.concl);
  return d.rule === 'assume' && d.label !== undefined ? `[${t}]^{${d.label}}` : t;
}

export function NDTree({ root, check, goals, selected, onSelect, numbers, highlight, small, label }: NDTreeProps) {
  return (
    <div className={`ndb-tree-wrap ${small ? 'small' : ''}`} role="group" aria-label={label ?? 'Derivation tree'}>
      <div className="ndb-tree-center">
        <Node d={root} check={check} goals={goals} selected={selected} onSelect={onSelect} numbers={numbers} highlight={highlight} />
      </div>
    </div>
  );
}

function Node({ d, check, goals, selected, onSelect, numbers, highlight }: Omit<NDTreeProps, 'root' | 'small' | 'label'> & { d: Deriv }): ReactNode {
  const isGoal = !!goals?.has(d.id);
  const st = check?.steps.get(d.id);
  const bad = !!st && !st.ok && !isGoal;
  const leaf = d.premises.length === 0;
  const withLine = !leaf || d.rule === 'eqI';
  const n = numbers?.get(d.id);
  const status = isGoal ? 'goal, not yet derived' : bad ? 'rejected by the checker' : st ? 'accepted' : '';
  const how = isGoal ? '' : d.rule === 'assume' ? `assumption${d.label !== undefined ? ` labelled ${d.label}` : ''}` : d.rule === 'axiom' ? `axiom ${d.name}` : d.rule === 'hyp' ? `hypothesis ${d.name}` : `by ${ruleShort(d)}`;
  const aria = `${n !== undefined ? `step ${n}: ` : ''}${ndText(d.concl)}, ${[how, status].filter(Boolean).join(', ')}`;
  const cls = ['ndb-f', isGoal ? 'goal' : '', d.rule === 'assume' ? 'assume' : '', selected === d.id ? 'sel' : '', bad ? 'bad' : '', highlight?.has(d.id) ? 'hl' : ''].filter(Boolean).join(' ');
  return (
    <div className="ndb-node">
      {!leaf && (
        <div className="ndb-prem">
          {d.premises.map((p) => (
            <Node key={p.id} d={p} check={check} goals={goals} selected={selected} onSelect={onSelect} numbers={numbers} highlight={highlight} />
          ))}
        </div>
      )}
      <div className={`ndb-concl ${withLine ? 'line' : ''} ${bad ? 'bad' : ''}`}>
        {!leaf && d.label !== undefined && <span className="ndb-label">{d.label}</span>}
        {onSelect ? (
          <button type="button" className={cls} onClick={() => onSelect(d.id)} aria-label={aria} aria-pressed={selected === d.id} data-step={d.id}>
            <Tex tex={isGoal ? ndTex(d.concl) : leafTex(d)} />
          </button>
        ) : (
          <span className={cls} aria-label={aria} role="img">
            <Tex tex={isGoal ? ndTex(d.concl) : leafTex(d)} />
          </span>
        )}
        {withLine && <span className="ndb-rule">{ruleShort(d)}</span>}
        {leaf && (d.rule === 'axiom' || d.rule === 'hyp') && !isGoal && <span className="ndb-rule muted">{d.name}</span>}
      </div>
    </div>
  );
}
