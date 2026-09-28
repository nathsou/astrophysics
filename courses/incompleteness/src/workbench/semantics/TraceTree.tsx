// A satisfaction trace as an expandable tree. Each row is one use of a clause of the definition
// of satisfaction: the subformula, the assignment, the clause, and why it gives this truth value.
// Quantifier rows list the x-variants tried, with the witness or counterexample marked; one
// variant's subtree is shown at a time. Rows carry data-n, so hovering a row lights up its
// subformula in the formula view above (and vice versa).

import { useMemo, useState, type ReactNode } from 'react';
import type { NodeId } from '../../engine/syntax/ast';
import type { Analysis } from '../../engine/syntax/analysis';
import { varName } from '../../engine/syntax/language';
import { decisivePath, type FormulaTrace, type TermTrace, type Truth } from '../../engine/semantics/trace';
import { highlightNode, clearHighlight } from '../../ui/FormulaView';
import { highlightStore } from '../../ui/store';
import './sem.css';

export function TruthBadge({ t, structure }: { t: Truth; structure?: string }) {
  const cls = t === 'unknown' ? 'unk' : t ? 'yes' : 'no';
  const sym = t === 'unknown' ? '?' : t ? '⊨' : '⊭';
  const word = t === 'unknown' ? 'unknown' : t ? 'satisfied' : 'not satisfied';
  return (
    <span className={`sem-badge ${cls}`} title={word}>
      <span aria-hidden="true">{sym}</span>
      <span className="sr-only">{word}</span>
      {structure && <span className="sem-badge-s">{structure}</span>}
    </span>
  );
}

interface Props<E> {
  trace: FormulaTrace<E>;
  show: (e: E) => string;
  analysis?: Analysis | null;
  /** How many levels to open initially along the decisive path (default: all of it). */
  structureName?: string;
}

export function TraceTree<E>({ trace, show, analysis, structureName }: Props<E>) {
  // Open the rows along the path that decides the result.
  const open = useMemo(() => new Set(decisivePath(trace).path.map((t) => t)), [trace]);
  return (
    <div className="sem-trace" role="tree" aria-label="Satisfaction trace">
      <Row t={trace} show={show} analysis={analysis ?? null} open={open} depth={0} parent={null} structureName={structureName} />
    </div>
  );
}

function hl(analysis: Analysis | null, id: NodeId) {
  if (analysis && analysis.byId.has(id)) highlightNode(analysis, id);
  else highlightStore.set({ primary: [id] });
}

function changed<E>(t: FormulaTrace<E>, parent: FormulaTrace<E> | null, show: (e: E) => string): string {
  const s = t.assignment;
  if (!parent) return s.size === 0 ? 's: (no variables assigned)' : `s: ${[...s].sort((a, b) => a[0] - b[0]).map(([i, e]) => `${varName(i)} ↦ ${show(e)}`).join(', ')}`;
  const diffs = [...s].filter(([i, e]) => parent.assignment.get(i) !== e || !parent.assignment.has(i));
  return diffs.length ? diffs.map(([i, e]) => `${varName(i)} ↦ ${show(e)}`).join(', ') : '';
}

function Row<E>({ t, show, analysis, open, depth, parent, structureName, label }: { t: FormulaTrace<E>; show: (e: E) => string; analysis: Analysis | null; open: Set<FormulaTrace<E>>; depth: number; parent: FormulaTrace<E> | null; structureName?: string; label?: ReactNode }) {
  const q = t.quantifier;
  const hasKids = t.children.length > 0 || t.terms.length > 0;
  const [expanded, setExpanded] = useState(depth === 0 || open.has(t));
  const decisive = q ? (q.kind === 'forall' ? q.counterexample : q.witness) : undefined;
  const initialVariant = q ? Math.max(0, q.variants.findIndex((v) => v.element === decisive)) : 0;
  const [variant, setVariant] = useState(initialVariant);
  const asg = changed(t, parent, show);
  const vt = q?.variants[variant]?.trace ?? null;
  return (
    <div className={`sem-row depth-${Math.min(depth, 6)}`} role="treeitem" aria-expanded={hasKids ? expanded : undefined} aria-level={depth + 1}>
      <div className="sem-row-head" onMouseEnter={() => hl(analysis, t.node)} onMouseLeave={clearHighlight}>
        {hasKids ? (
          <button className="sem-twisty" aria-label={expanded ? 'collapse' : 'expand'} aria-expanded={expanded} onClick={() => setExpanded((x) => !x)} onFocus={() => hl(analysis, t.node)} onBlur={clearHighlight}>
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="sem-twisty-sp" />
        )}
        <TruthBadge t={t.truth} />
        {label && <span className="sem-row-label">{label}</span>}
        <span className="sem-ftext" data-n={t.node}>
          {t.text}
        </span>
        {asg && <span className="sem-asg">[{asg}]</span>}
      </div>
      <div className="sem-row-why">
        <span className="sem-clause">{t.clause}</span>
        <span className="sem-detail">{t.detail}</span>
      </div>
      {expanded && (
        <div className="sem-kids" role="group">
          {t.terms.length > 0 && (
            <div className="sem-terms">
              {t.terms.map((x, i) => (
                <TermRow key={i} t={x} show={show} analysis={analysis} />
              ))}
            </div>
          )}
          {q ? (
            <>
              <div className="sem-variants" role="group" aria-label={`${varName(q.variable)}-variants tried`}>
                <span className="sem-vlabel">
                  {varName(q.variable)}-variants s[m/{varName(q.variable)}] tried ({q.variants.length}, m in {q.range}):
                </span>
                {q.variants.map((v, i) => {
                  const mark = v.truth === 'unknown' ? '?' : v.truth ? '✓' : '✗';
                  const isDec = decisive !== undefined && v.element === decisive;
                  return (
                    <button
                      key={i}
                      className={`sem-variant ${v.truth === 'unknown' ? 'unk' : v.truth ? 'yes' : 'no'} ${isDec ? 'decisive' : ''}`}
                      aria-pressed={variant === i}
                      disabled={!v.trace}
                      onClick={() => setVariant(i)}
                      title={isDec ? (q.kind === 'forall' ? 'counterexample' : 'witness') : undefined}
                    >
                      {varName(q.variable)} = {show(v.element)} {mark}
                      {isDec && <span className="sem-dec">{q.kind === 'forall' ? ' counterexample' : ' witness'}</span>}
                    </button>
                  );
                })}
              </div>
              {vt && <Row key={variant} t={vt} show={show} analysis={analysis} open={open} depth={depth + 1} parent={t} label={<>{varName(q.variable)} = {show(q.variants[variant].element)}:</>} />}
            </>
          ) : (
            t.children.map((c, i) => <Row key={i} t={c} show={show} analysis={analysis} open={open} depth={depth + 1} parent={t} />)
          )}
        </div>
      )}
    </div>
  );
}

function TermRow<E>({ t, show, analysis }: { t: TermTrace<E>; show: (e: E) => string; analysis: Analysis | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sem-term">
      <div className="sem-term-head" onMouseEnter={() => hl(analysis, t.node)} onMouseLeave={clearHighlight}>
        {t.children.length > 0 ? (
          <button className="sem-twisty" aria-label={open ? 'collapse term' : 'expand term'} aria-expanded={open} onClick={() => setOpen((x) => !x)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="sem-twisty-sp" />
        )}
        <span className="sem-ttext" data-n={t.node}>
          {t.text}
        </span>
        <span className="sem-tval">= {t.value === null ? '—' : show(t.value)}</span>
        <span className="sem-detail">{t.detail}</span>
      </div>
      {open && (
        <div className="sem-kids">
          {t.children.map((c, i) => (
            <TermRow key={i} t={c} show={show} analysis={analysis} />
          ))}
        </div>
      )}
    </div>
  );
}
