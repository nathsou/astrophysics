// A derivation, shown like a debugger: every step says what it claims, which earlier steps it
// uses, which rule licenses it (with the rule as the book states it), which assumptions it
// depends on, and whether the checker accepted it. Long derivations are grouped into stages
// that expand into their individual inferences.

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { CheckResult, Deriv, OpenAssumption } from '../engine/proof/nd';
import { linearize, RULE_NAMES, RULE_SCHEMA } from '../engine/proof/nd';
import { formulaTex, termTex } from '../engine/syntax/print';
import { constName } from '../engine/syntax/language';
import { constants } from '../engine/syntax/ops';
import { Tex } from './Tex';
import { FormulaView } from './FormulaView';
import { Prov } from './Prov';
import { highlightStore, inspect } from './store';

export interface ProofDebuggerProps {
  deriv: Deriv;
  check: CheckResult;
  title?: ReactNode;
  /** Descriptions of hypotheses, by name (e.g. what theorem provides them). */
  hypotheses?: Record<string, ReactNode>;
  /** Start with every group expanded. */
  expanded?: boolean;
}

interface Row {
  d: Deriv;
  n: number;
}

export function ProofDebugger({ deriv, check, title, hypotheses, expanded = false }: ProofDebuggerProps) {
  const rows: Row[] = useMemo(() => linearize(deriv).map((d, i) => ({ d, n: i + 1 })), [deriv]);
  const num = useMemo(() => new Map(rows.map((r) => [r.d.id, r.n])), [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.d.id, r.d])), [rows]);
  // Groups: maximal runs of consecutive rows with the same group name.
  const groups = useMemo(() => {
    const out: { name: string | undefined; rows: Row[] }[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.name === r.d.group) last.rows.push(r);
      else out.push({ name: r.d.group, rows: [r] });
    }
    return out;
  }, [rows]);
  const [open, setOpen] = useState<Set<number>>(() => new Set(expanded ? groups.map((_, i) => i) : [groups.length - 1]));
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<'steps' | 'tree'>('steps');
  const ok = check.valid;

  const select = (id: string, pin = true) => {
    setSel(id);
    const d = byId.get(id)!;
    highlightStore.set({ primary: [id], secondary: d.premises.map((p) => p.id), binder: check.steps.get(id)?.discharged.map((a) => a.id) ?? [] });
    inspect(stepEntry(d, num, check, hypotheses, (x) => select(x)), pin);
  };

  const visible: Row[] = [];
  groups.forEach((g, gi) => {
    if (open.has(gi) || g.rows.length === 1) visible.push(...g.rows);
    else visible.push(g.rows[g.rows.length - 1]);
  });

  return (
    <div className="proof-debugger">
      <div className="pd-head">
        <div className="pd-title">
          {title}
          {ok ? <Prov kind="checked">Checked: {check.size} inferences</Prov> : <Prov kind="failed">{check.errors.length} error{check.errors.length === 1 ? '' : 's'}</Prov>}
        </div>
        <div className="pd-meta sans">
          {check.axioms.length > 0 && (
            <span>
              axioms used: {check.axioms.map((a) => <code key={a}>{a}</code>)}
            </span>
          )}
          {check.hypotheses.length > 0 && (
            <span>
              hypotheses: {check.hypotheses.map((a) => <code key={a} className="hyp">{a}</code>)}
            </span>
          )}
          <span>
            {check.open.some((o) => o.kind === 'assume') ? `${check.open.filter((o) => o.kind === 'assume').length} undischarged assumption(s)` : 'no undischarged assumptions'}
          </span>
          <span className="pd-views" role="radiogroup" aria-label="View">
            <button role="radio" aria-checked={view === 'steps'} className="chip-btn" aria-pressed={view === 'steps'} onClick={() => setView('steps')}>
              steps
            </button>
            <button role="radio" aria-checked={view === 'tree'} className="chip-btn" aria-pressed={view === 'tree'} onClick={() => setView('tree')} disabled={rows.length > 60} title={rows.length > 60 ? 'Too large to draw as a tree' : 'Natural deduction tree'}>
              tree
            </button>
            <button className="chip-btn" onClick={() => setOpen(new Set(open.size === groups.length ? [] : groups.map((_, i) => i)))}>
              {open.size === groups.length ? 'collapse all' : 'expand all'}
            </button>
          </span>
        </div>
      </div>

      {view === 'steps' ? (
        <ol
          className="pd-steps"
          role="listbox"
          aria-label="Steps of the derivation"
          tabIndex={0}
          onKeyDown={(e) => {
            const i = visible.findIndex((r) => r.d.id === sel);
            if (e.key === 'ArrowDown') select(visible[Math.min(visible.length - 1, i + 1)].d.id);
            else if (e.key === 'ArrowUp') select(visible[Math.max(0, i - 1)].d.id);
            else if (e.key === 'Home') select(visible[0].d.id);
            else if (e.key === 'End') select(visible[visible.length - 1].d.id);
            else return;
            e.preventDefault();
          }}
          onMouseLeave={() => highlightStore.set(null)}
        >
          {groups.map((g, gi) => {
            const isOpen = open.has(gi) || g.rows.length === 1;
            const shown = isOpen ? g.rows : [g.rows[g.rows.length - 1]];
            return (
              <Fragment key={gi}>
                {g.name && g.rows.length > 1 && (
                  <li className="pd-group" role="presentation">
                    <button
                      aria-expanded={isOpen}
                      onClick={() => {
                        const next = new Set(open);
                        if (next.has(gi)) next.delete(gi);
                        else next.add(gi);
                        setOpen(next);
                      }}
                    >
                      <span className="caret">{isOpen ? '▾' : '▸'}</span> {g.name}
                      <span className="muted"> — {isOpen ? `${g.rows.length} steps` : `${g.rows.length} steps, showing the conclusion`}</span>
                    </button>
                  </li>
                )}
                {shown.map((r) => (
                  <StepRow key={r.d.id} r={r} num={num} check={check} selected={sel === r.d.id} onSelect={select} indent={!!g.name && g.rows.length > 1} />
                ))}
              </Fragment>
            );
          })}
        </ol>
      ) : (
        <div className="pd-tree">
          <TreeNode d={deriv} check={check} sel={sel} onSelect={select} num={num} />
        </div>
      )}
      {!ok && (
        <ul className="pd-errors sans">
          {check.errors.map((e, i) => (
            <li key={i}>
              <button className="linklike" onClick={() => select(e.id)}>
                step {num.get(e.id) ?? '?'}
              </button>
              : {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepRow({ r, num, check, selected, onSelect, indent }: { r: Row; num: Map<string, number>; check: CheckResult; selected: boolean; onSelect: (id: string, pin?: boolean) => void; indent: boolean }) {
  const d = r.d;
  const st = check.steps.get(d.id);
  const bad = st && !st.ok;
  return (
    <li
      className={`pd-step ${selected ? 'selected' : ''} ${bad ? 'bad' : ''} ${indent ? 'indent' : ''}`}
      role="option"
      aria-selected={selected}
      data-n={d.id}
      onClick={() => onSelect(d.id)}
      onMouseEnter={() => highlightStore.set({ primary: [d.id], secondary: d.premises.map((p) => p.id), binder: st?.discharged.map((a) => a.id) ?? [] })}
    >
      <span className="pd-num">{r.n}</span>
      <span className="pd-formula">
        {d.rule === 'assume' && d.label !== undefined ? (
          <Tex tex={`[${formulaTex(d.concl)}]^{${d.label}}`} />
        ) : (
          <Tex tex={formulaTex(d.concl)} />
        )}
      </span>
      <span className="pd-rule">
        {d.rule === 'axiom' ? (
          <span className="pd-axiom">axiom {d.name}</span>
        ) : d.rule === 'hyp' ? (
          <span className="pd-hyp">hypothesis {d.name}</span>
        ) : d.rule === 'assume' ? (
          <span className="muted">assumption</span>
        ) : (
          <>
            {RULE_NAMES[d.rule]}
            {d.premises.length > 0 && <span className="muted"> {d.premises.map((p) => num.get(p.id)).join(', ')}</span>}
            {d.label !== undefined && <span className="pd-disch"> [{d.label}]</span>}
          </>
        )}
      </span>
      <span className={`pd-status ${bad ? 'no' : 'yes'}`} aria-label={bad ? 'rejected' : 'checked'}>
        {bad ? '✗' : '✓'}
      </span>
    </li>
  );
}

function TreeNode({ d, check, sel, onSelect, num }: { d: Deriv; check: CheckResult; sel: string | null; onSelect: (id: string) => void; num: Map<string, number> }): ReactNode {
  const bad = !check.steps.get(d.id)?.ok;
  const leafLabel = d.rule === 'axiom' ? d.name : d.rule === 'hyp' ? d.name : undefined;
  return (
    <div className="tree-node">
      {d.premises.length > 0 && (
        <div className="tree-premises">
          {d.premises.map((p) => (
            <TreeNode key={p.id} d={p} check={check} sel={sel} onSelect={onSelect} num={num} />
          ))}
        </div>
      )}
      <div className={`tree-concl ${d.premises.length ? 'line-single' : 'line-none'} ${sel === d.id ? 'selected' : ''} ${bad ? 'bad' : ''}`} data-n={d.id}>
        {d.label !== undefined && d.rule !== 'assume' && <span className="tree-left">{d.label}</span>}
        <button className="tree-formula" onClick={() => onSelect(d.id)} title={`step ${num.get(d.id)}`}>
          <Tex tex={d.rule === 'assume' && d.label !== undefined ? `[${formulaTex(d.concl)}]^{${d.label}}` : formulaTex(d.concl)} />
        </button>
        {d.premises.length > 0 && <span className="tree-right">{RULE_NAMES[d.rule]}</span>}
        {leafLabel && <span className="tree-right muted">{leafLabel}</span>}
      </div>
    </div>
  );
}

function assumptionLine(o: OpenAssumption, hypotheses?: Record<string, ReactNode>) {
  return (
    <li key={o.id}>
      <Tex tex={formulaTex(o.formula)} />{' '}
      <span className="muted">
        {o.kind === 'axiom' ? `— axiom ${o.name} of Q` : o.kind === 'hyp' ? `— hypothesis ${o.name}` : `— assumption${o.label !== undefined ? ` labelled ${o.label}` : ''}`}
      </span>
      {o.kind === 'hyp' && o.name && hypotheses?.[o.name] && <div className="small">{hypotheses[o.name]}</div>}
    </li>
  );
}

function stepEntry(d: Deriv, num: Map<string, number>, check: CheckResult, hypotheses: Record<string, ReactNode> | undefined, go: (id: string) => void) {
  const st = check.steps.get(d.id)!;
  const n = num.get(d.id);
  const eigen = d.eigen !== undefined ? constName(d.eigen) : null;
  return {
    key: `step:${d.id}`,
    kicker: `Step ${n} · ${RULE_NAMES[d.rule]}`,
    title: <FormulaView node={d.concl} label="claim" />,
    body: (
      <>
        <div className="sec">
          <div className="sec-title">Claim</div>
          <p>
            {d.rule === 'assume'
              ? 'This sentence is assumed.'
              : d.rule === 'axiom'
                ? `This is axiom ${d.name} of Q.`
                : d.rule === 'hyp'
                  ? `This is taken from elsewhere in the text (${d.name}).`
                  : 'This sentence follows from the premises by the rule below.'}
          </p>
        </div>
        {d.premises.length > 0 && (
          <div className="sec">
            <div className="sec-title">Uses</div>
            <ul className="pd-uses">
              {d.premises.map((p) => (
                <li key={p.id}>
                  <button className="linklike" onClick={() => go(p.id)}>
                    step {num.get(p.id)}
                  </button>{' '}
                  <Tex tex={formulaTex(p.concl)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="sec">
          <div className="sec-title">Rule</div>
          <p>
            <b>{RULE_NAMES[d.rule]}</b>. {RULE_SCHEMA[d.rule]}
          </p>
          {d.term && (
            <p>
              Here the term is <Tex tex={termTex(d.term)} />, a closed term.
            </p>
          )}
          {eigen && (
            <p>
              Eigenvariable <Tex tex={eigen} />: it does not occur in the conclusion{d.rule === 'exE' ? ' or in the existential premise' : ''}
              {st.open.some((o) => constants(o.formula).has(d.eigen!)) ? ' — but it does occur in an undischarged assumption!' : ', nor in any undischarged assumption'}.
            </p>
          )}
        </div>
        {st.discharged.length > 0 && (
          <div className="sec">
            <div className="sec-title">Discharges</div>
            <ul>{st.discharged.map((o) => assumptionLine(o, hypotheses))}</ul>
          </div>
        )}
        <div className="sec">
          <div className="sec-title">Depends on</div>
          {st.open.length === 0 ? <p className="muted">Nothing: it holds outright.</p> : <ul>{st.open.map((o) => assumptionLine(o, hypotheses))}</ul>}
        </div>
        {d.note && (
          <div className="sec">
            <Prov kind="added">Note</Prov> <span>{d.note}</span>
          </div>
        )}
        <div className="sec">
          {st.ok ? <Prov kind="checked">verified by the checker</Prov> : (
            <>
              <Prov kind="failed" />
              <ul>
                {st.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </>
    ),
  };
}
