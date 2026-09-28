// Interactive rendering of terms and formulas from their typed trees.
//
// Every element carries `data-n` (the id of the AST node it belongs to). Hovering, focusing or
// tapping a node highlights its subtree — and, for a variable, the quantifier that binds it and
// the other occurrences bound by that quantifier — in every view on the page that shows the same
// nodes (token strips, code tables, trees). The inspector explains the node.

import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Formula, Node, NodeId, Term } from '../engine/syntax/ast';
import { analyze, related, subtreeIds, type Analysis } from '../engine/syntax/analysis';
import { constName, fnName, predName, sub, varName } from '../engine/syntax/language';
import { freeVars, numeralValue } from '../engine/syntax/ops';
import { formulaTex, nodeTex, termTex } from '../engine/syntax/print';
import { evaluate, formatMagnitude, magnitude, show } from '../engine/numbers/nat';
import { highlightStore, inspect, type InspectorEntry } from './store';
import { Tex } from './Tex';

export interface FormulaViewProps {
  node: Node;
  analysis?: Analysis;
  /** Extra inspector content for a node (e.g. its symbols and codes). */
  describe?: (id: NodeId, a: Analysis) => ReactNode;
  /** Called when a node is activated (click / Enter). */
  onActivate?: (id: NodeId) => void;
  className?: string;
  /** Show ¬ s = t as s ≠ t (default). */
  neq?: boolean;
  label?: string;
  /** Ids to mark as selected (persistent emphasis, e.g. the current step). */
  marked?: NodeId[];
  /** Called after a node is hovered or focused (e.g. to highlight related things elsewhere). */
  onHoverNode?: (id: NodeId) => void;
}

export function useAnalysis(node: Node | null | undefined): Analysis | null {
  return useMemo(() => (node ? analyze(node) : null), [node]);
}

/** Highlight a node of an analysed expression and everything related to it. */
export function highlightNode(a: Analysis, id: NodeId) {
  const rel = related(a, id);
  highlightStore.set({ primary: subtreeIds(a, id), secondary: rel.siblings, binder: rel.binder ? [rel.binder] : [] });
}

export function clearHighlight() {
  highlightStore.set(null);
}

export function FormulaView({ node, analysis, describe, onActivate, className, neq = true, label, marked, onHoverNode }: FormulaViewProps) {
  const own = useAnalysis(analysis ? null : node);
  const a = analysis ?? own!;
  const rootRef = useRef<HTMLSpanElement>(null);
  const [focusId, setFocusId] = useState<NodeId | null>(null);
  const [announce, setAnnounce] = useState('');

  const entry = (id: NodeId): InspectorEntry => describeNode(a, id, describe);
  const idAt = (el: EventTarget | null): NodeId | null => {
    const t = (el as HTMLElement | null)?.closest?.('[data-n]') as HTMLElement | null;
    if (!t || !rootRef.current?.contains(t)) return null;
    return t.dataset.n ?? null;
  };
  const focusNode = (id: NodeId) => {
    setFocusId(id);
    highlightNode(a, id);
    onHoverNode?.(id);
    inspect(entry(id));
    const n = a.byId.get(id);
    if (n) setAnnounce(`${kindName(n)}: ${plainOf(n)}`);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const cur = focusId ?? a.root.id;
    const i = a.order.indexOf(cur);
    let next: NodeId | null = null;
    if (e.key === 'ArrowRight') next = a.order[Math.min(a.order.length - 1, i + 1)];
    else if (e.key === 'ArrowLeft') next = a.order[Math.max(0, i - 1)];
    else if (e.key === 'ArrowUp') next = a.parent.get(cur) ?? cur;
    else if (e.key === 'ArrowDown') next = a.order[i + 1] && a.parent.get(a.order[i + 1]) === cur ? a.order[i + 1] : cur;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inspect(entry(cur), true);
      onActivate?.(cur);
      return;
    } else if (e.key === 'Escape') {
      setFocusId(null);
      clearHighlight();
      inspect(null, true);
      return;
    } else return;
    e.preventDefault();
    if (next) focusNode(next);
  };

  return (
    <span
      ref={rootRef}
      className={`fv-root ${className ?? ''}`}
      tabIndex={0}
      role="group"
      aria-label={`${label ?? (isTermNode(node) ? 'term' : 'formula')}: ${plainOf(node)}. Use the arrow keys to move between parts.`}
      onMouseOver={(e) => {
        const id = idAt(e.target);
        if (id) {
          highlightNode(a, id);
          onHoverNode?.(id);
          inspect(entry(id));
        }
      }}
      onMouseLeave={() => clearHighlight()}
      onClick={(e) => {
        const id = idAt(e.target);
        if (!id) return;
        setFocusId(id);
        highlightNode(a, id);
        inspect(entry(id), true);
        onActivate?.(id);
      }}
      onFocus={() => focusId === null && focusNode(a.root.id)}
      onBlur={() => clearHighlight()}
      onKeyDown={onKeyDown}
    >
      <Render n={node} neq={neq} focus={focusId} marked={marked} outer />
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </span>
  );
}

function isTermNode(n: Node): n is Term {
  return n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral';
}

function plainOf(n: Node): string {
  return nodeTex(n)
    .replace(/\\(forall|exists|lnot|land|lor|rightarrow|leftrightarrow|neq|bot|top|times|ulcorner|urcorner|overline|,)/g, (m) =>
      ({ '\\forall': '∀', '\\exists': '∃', '\\lnot': '¬', '\\land': '∧', '\\lor': '∨', '\\rightarrow': '→', '\\leftrightarrow': '↔', '\\neq': '≠', '\\bot': '⊥', '\\top': '⊤', '\\times': '×', '\\ulcorner': '⌜', '\\urcorner': '⌝', '\\overline': '', '\\,': ' ' })[m] ?? m,
    )
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ');
}

export function kindName(n: Node): string {
  switch (n.k) {
    case 'var':
      return 'variable';
    case 'const':
      return n.index === 0 ? 'the constant 0' : 'constant';
    case 'numeral':
      return 'numeral';
    case 'app':
      return n.arity === 1 && n.index === 0 ? 'successor term' : n.arity === 2 && n.index === 0 ? 'sum' : n.arity === 2 && n.index === 1 ? 'product' : 'function term';
    case 'bot':
      return 'falsity';
    case 'top':
      return 'truth (defined)';
    case 'eq':
      return 'identity';
    case 'pred':
      return n.arity === 2 && n.index === 0 ? 'less-than' : 'atomic formula';
    case 'abbr':
      return 'named formula';
    case 'not':
      return 'negation';
    case 'and':
      return 'conjunction';
    case 'or':
      return 'disjunction';
    case 'imp':
      return 'conditional';
    case 'iff':
      return 'biconditional (defined)';
    case 'forall':
      return 'universal quantification';
    case 'exists':
      return 'existential quantification';
  }
}

// ------------------------------------------------------------------ rendering

interface RP {
  n: Node;
  neq: boolean;
  focus: NodeId | null;
  marked?: NodeId[];
  outer?: boolean;
}

const cls = (base: string, id: NodeId, focus: NodeId | null, marked?: NodeId[]) =>
  `${base}${focus === id ? ' fv-focus' : ''}${marked?.includes(id) ? ' fv-marked' : ''}`;

function Sym({ children, c = 'op' }: { children: ReactNode; c?: string }) {
  return <span className={`fv-${c}`}>{children}</span>;
}

function VarName({ index }: { index: number }) {
  const name = varName(index);
  const [base, subscript] = name.split('_');
  return (
    <>
      <i>{base}</i>
      {subscript !== undefined && <sub>{subscript}</sub>}
    </>
  );
}

function Render({ n, neq, focus, marked, outer }: RP): ReactNode {
  const p = { neq, focus, marked };
  const id = n.id;
  switch (n.k) {
    case 'var':
      return (
        <span className={cls('fv fv-var', id, focus, marked)} data-n={id}>
          <VarName index={n.index} />
        </span>
      );
    case 'const':
      return (
        <span className={cls('fv fv-const', id, focus, marked)} data-n={id}>
          {n.index === 0 ? '0' : <i>{constName(n.index)}</i>}
        </span>
      );
    case 'numeral': {
      const v = evaluate(n.value, 64);
      return (
        <span className={cls('fv fv-numeral', id, focus, marked)} data-n={id} title="a numeral: a term of arithmetic">
          {n.quotes !== undefined ? <Tex tex={`\\ulcorner ${n.quotes} \\urcorner`} /> : <span className="fv-bar">{v !== null && v < 10n ** 12n ? v.toString() : '…'}</span>}
        </span>
      );
    }
    case 'app': {
      if (n.arity === 1 && n.index === 0) {
        const a = n.args[0];
        const wrap = a.k === 'app' && a.arity === 2;
        return (
          <span className={cls('fv fv-term', id, focus, marked)} data-n={id}>
            {wrap && <Sym c="paren">(</Sym>}
            <Render n={a} {...p} />
            {wrap && <Sym c="paren">)</Sym>}
            <Sym c="prime">′</Sym>
          </span>
        );
      }
      if (n.arity === 2 && (n.index === 0 || n.index === 1)) {
        return (
          <span className={cls('fv fv-term', id, focus, marked)} data-n={id}>
            <Sym c="paren">(</Sym>
            <Render n={n.args[0]} {...p} />
            <Sym c="bin">{n.index === 0 ? '+' : '×'}</Sym>
            <Render n={n.args[1]} {...p} />
            <Sym c="paren">)</Sym>
          </span>
        );
      }
      return (
        <span className={cls('fv fv-term', id, focus, marked)} data-n={id}>
          <i className="fv-fn">{fnName(n.arity, n.index)}</i>
          <Sym c="paren">(</Sym>
          {n.args.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Sym c="comma">, </Sym>}
              <Render n={a} {...p} />
            </Fragment>
          ))}
          <Sym c="paren">)</Sym>
        </span>
      );
    }
    case 'bot':
    case 'top':
      return (
        <span className={cls('fv fv-atom', id, focus, marked)} data-n={id}>
          {n.k === 'bot' ? '⊥' : '⊤'}
        </span>
      );
    case 'eq':
      return (
        <span className={cls('fv fv-atom', id, focus, marked)} data-n={id}>
          <Render n={n.l} {...p} />
          <Sym c="rel">=</Sym>
          <Render n={n.r} {...p} />
        </span>
      );
    case 'pred':
      if (n.arity === 2 && n.index === 0) {
        return (
          <span className={cls('fv fv-atom', id, focus, marked)} data-n={id}>
            <Render n={n.args[0]} {...p} />
            <Sym c="rel">&lt;</Sym>
            <Render n={n.args[1]} {...p} />
          </span>
        );
      }
      return (
        <span className={cls('fv fv-atom', id, focus, marked)} data-n={id}>
          <i className="fv-pred">{predName(n.arity, n.index)}</i>
          <Sym c="paren">(</Sym>
          {n.args.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Sym c="comma">, </Sym>}
              <Render n={a} {...p} />
            </Fragment>
          ))}
          <Sym c="paren">)</Sym>
        </span>
      );
    case 'abbr':
      return (
        <span className={cls('fv fv-atom fv-abbr', id, focus, marked)} data-n={id}>
          <Tex tex={n.tex} />
          <Sym c="paren">(</Sym>
          {n.args.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Sym c="comma">, </Sym>}
              <Render n={a} {...p} />
            </Fragment>
          ))}
          <Sym c="paren">)</Sym>
        </span>
      );
    case 'not':
      if (neq && n.a.k === 'eq') {
        return (
          <span className={cls('fv fv-atom', id, focus, marked)} data-n={id}>
            <span data-n={n.a.id} className="fv">
              <Render n={n.a.l} {...p} />
              <Sym c="rel">≠</Sym>
              <Render n={n.a.r} {...p} />
            </span>
          </span>
        );
      }
      return (
        <span className={cls('fv fv-not', id, focus, marked)} data-n={id}>
          <Sym c="unary">¬</Sym>
          <Render n={n.a} {...p} />
        </span>
      );
    case 'and':
    case 'or':
    case 'imp':
    case 'iff':
      return (
        <span className={cls('fv fv-bin', id, focus, marked)} data-n={id}>
          {!outer && <Sym c="paren">(</Sym>}
          <Render n={n.a} {...p} />
          <Sym c="conn">{{ and: '∧', or: '∨', imp: '→', iff: '↔' }[n.k]}</Sym>
          <Render n={n.b} {...p} />
          {!outer && <Sym c="paren">)</Sym>}
        </span>
      );
    case 'forall':
    case 'exists':
      return (
        <span className={cls('fv fv-quant', id, focus, marked)} data-n={id}>
          <Sym c="quant">{n.k === 'forall' ? '∀' : '∃'}</Sym>
          <Render n={n.v} {...p} />
          <span className="fv-qsp"> </span>
          <Render n={n.body} {...p} />
        </span>
      );
  }
}

// ------------------------------------------------------------------ inspector content

export function describeNode(a: Analysis, id: NodeId, extra?: (id: NodeId, a: Analysis) => ReactNode): InspectorEntry {
  const n = a.byId.get(id);
  if (!n) return { key: id, title: '?', body: null };
  const tex = nodeTex(n);
  const rel = related(a, id);
  let what: ReactNode = null;
  switch (n.k) {
    case 'var': {
      if (a.binderVars.has(id)) what = <p>The variable written after a quantifier. It says which variable the quantifier binds; it is not itself an occurrence that could be free or bound.</p>;
      else if (rel.binder) {
        const q = a.byId.get(rel.binder)!;
        what = (
          <p>
            A <b>bound</b> occurrence of <Tex tex={termTex(n)} />: it is bound by the quantifier <Tex tex={q.k === 'forall' ? '\\forall' : '\\exists'} />
            <Tex tex={termTex(n)} /> (highlighted). {rel.siblings.length > 1 ? `That quantifier binds ${rel.siblings.length} occurrences.` : ''}
          </p>
        );
      } else what = <p>A <b>free</b> occurrence of <Tex tex={termTex(n)} />. Substituting a term for <Tex tex={termTex(n)} /> replaces it.</p>;
      what = (
        <>
          {what}
          <p className="muted">Officially the variable v{sub(n.index)}.</p>
        </>
      );
      break;
    }
    case 'numeral': {
      const v = evaluate(n.value, 64);
      what = (
        <>
          <p>
            A <b>numeral</b>: a term of arithmetic, <Tex tex="0'' \cdots '" /> with {v !== null ? v.toString() : 'that many'} successor symbols. It <em>denotes</em> the number{' '}
            {v !== null ? v.toString() : 'written below'}; it is not that number.
          </p>
          {n.quotes !== undefined && (
            <p>
              Written <Tex tex={`\\ulcorner ${n.quotes} \\urcorner`} />: the numeral for the Gödel number of <Tex tex={n.quotes} />.
            </p>
          )}
          {v === null && <p className="muted">The number has {formatMagnitude(magnitude(n.value, { lowerBound: true }))} (at least).</p>}
        </>
      );
      break;
    }
    case 'const':
      what = <p>{n.index === 0 ? 'The constant symbol 0 (officially c₀). As a term it is also the numeral for 0.' : `A constant symbol (officially c${sub(n.index)}); in derivations such constants serve as eigenvariables.`}</p>;
      break;
    case 'app': {
      const nv = numeralValue(n);
      what = <p>A {kindName(n)}.{nv ? <> It is the numeral <Tex tex={`\\overline{${show(nv)}}`} />.</> : null}</p>;
      break;
    }
    case 'abbr':
      what = <p>A named formula: it stands for a definite formula of arithmetic that is too long to write out. Its free variables are its arguments.</p>;
      break;
    case 'forall':
    case 'exists':
      what = <p>The quantifier binds the free occurrences of <Tex tex={termTex(n.v)} /> in its scope ({rel.siblings.length} here, highlighted).</p>;
      break;
    case 'iff':
      what = <p>In this book ↔ is not a primitive symbol: <Tex tex="A \leftrightarrow B" /> abbreviates <Tex tex="(A \rightarrow B) \land (B \rightarrow A)" />.</p>;
      break;
    default:
      what = <p>{capital(kindName(n))}.</p>;
  }
  const fv = freeVars(n);
  const isF = !(n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral');
  return {
    key: `node:${id}`,
    kicker: capital(kindName(n)),
    title: <Tex tex={isF ? formulaTex(n as Formula) : tex} />,
    body: (
      <>
        {what}
        {isF && (
          <p className="muted">
            {fv.size === 0 ? 'No free variables: a sentence.' : `Free variables: ${[...fv].map(varName).join(', ')}.`}
          </p>
        )}
        {extra?.(id, a)}
      </>
    ),
  };
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
