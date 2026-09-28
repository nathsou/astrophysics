// Shared pieces of the workbenches of the chapter "Recursive Functions": argument parsing,
// definition trees that unfold named definitions down to zero, succ and projections, evaluation
// call trees, budgets, and the wording of bounded outcomes.

import { useState, type ReactNode } from 'react';
import { BASIC_TEX, type Call, type RF } from '../../engine/recursive/rf';
import { arity } from '../../engine/recursive/rf';
import type { PhiOutcome } from '../../engine/computability/indices';
import { persist, persisted } from '../../ui/store';
import { Tex } from '../../ui/Tex';
import './recursion.css';

/** Parse `k` natural numbers, each at most `max`. */
export function parseNats(text: string, k: number, max: bigint): bigint[] | string {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== k) return k === 0 ? 'no arguments are needed' : `${k} number${k === 1 ? '' : 's'} needed`;
  if (!parts.every((p) => /^\d+$/.test(p))) return 'arguments must be natural numbers';
  const xs = parts.map((p) => BigInt(p));
  if (xs.some((x) => x > max)) return `keep the numbers at most ${max} here`;
  return xs;
}

/** A state that is remembered in this browser. */
export function useRemembered<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => persisted(`ic.rec.${key}`, initial));
  return [
    v,
    (nv: T) => {
      setV(nv);
      persist(`ic.rec.${key}`, nv);
    },
  ];
}

/** A TeX name for a definition: its name if it has one, otherwise its kind. */
export function nameTex(f: RF): string {
  switch (f.k) {
    case 'def':
      return f.tex;
    case 'zero':
      return '\\mathrm{zero}';
    case 'succ':
      return '\\mathrm{succ}';
    case 'proj':
      return `P^{${f.n}}_{${f.i}}`;
    case 'basic':
      return BASIC_TEX[f.name];
    case 'comp':
      return 'h';
    case 'rec':
      return 'h';
    case 'min':
      return '\\mu';
  }
}

export const arityOf = (f: RF): number | null => {
  const a = arity(f);
  return a.ok ? a.arity : null;
};

const sub = (i: number) => String(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

// ------------------------------------------------------------------ definition tree

/**
 * A definition as a tree. Named definitions (add, pred, …) are folded and can be unfolded, down
 * to zero, succ and the projections.
 */
export function DefTree({ f, openNames = 0, label }: { f: RF; openNames?: number; label?: string }) {
  const [gen, setGen] = useState(0);
  const [all, setAll] = useState(false);
  return (
    <div className="rc-deftree" aria-label={label ?? 'Definition tree'}>
      <div className="rc-deftree-tools">
        <button className="chip-btn" onClick={() => { setAll(true); setGen((g) => g + 1); }}>
          unfold everything
        </button>
        <button className="chip-btn" onClick={() => { setAll(false); setGen((g) => g + 1); }}>
          fold named definitions
        </button>
      </div>
      <DefNode key={gen} f={f} depth={0} openNames={all ? Infinity : openNames} />
    </div>
  );
}

function DefNode({ f, depth, openNames, role }: { f: RF; depth: number; openNames: number; role?: ReactNode }): ReactNode {
  const [open, setOpen] = useState(() => f.k !== 'def' || depth === 0 || openNames > 0);
  const ar = arityOf(f);
  const arTag = ar === null ? <span className="rc-tag bad">ill-formed</span> : <span className="rc-tag">{ar}-place</span>;
  const roleEl = role ? <span className="rc-role">{role}</span> : null;
  if (f.k === 'def') {
    return (
      <div className="rc-node def">
        <div className="rc-line">
          {roleEl}
          <button className="rc-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`${open ? 'fold' : 'unfold'} the definition of ${f.name}`}>
            {open ? '▾' : '▸'}
          </button>
          <Tex tex={f.tex} />
          {arTag}
          {!open && <span className="rc-hint">named definition — unfold</span>}
        </div>
        {open && (
          <div className="rc-children">
            <DefNode f={f.body} depth={depth + 1} openNames={openNames - 1} />
          </div>
        )}
      </div>
    );
  }
  if (f.k === 'comp' || f.k === 'rec' || f.k === 'min') {
    const kind = f.k === 'comp' ? 'composition' : f.k === 'rec' ? 'primitive recursion' : 'unbounded search μ';
    return (
      <div className={`rc-node ${f.k}`}>
        <div className="rc-line">
          {roleEl}
          <button className="rc-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`${open ? 'fold' : 'unfold'} this ${kind}`}>
            {open ? '▾' : '▸'}
          </button>
          <span className="rc-kind">{kind}</span>
          {arTag}
        </div>
        {open && (
          <div className="rc-children">
            {f.k === 'comp' && (
              <>
                <DefNode f={f.f} depth={depth + 1} openNames={openNames} role="outer f" />
                {f.gs.map((g, i) => (
                  <DefNode key={g.id} f={g} depth={depth + 1} openNames={openNames} role={`inner g${sub(i)}`} />
                ))}
              </>
            )}
            {f.k === 'rec' && (
              <>
                <DefNode f={f.f} depth={depth + 1} openNames={openNames} role="base f" />
                <DefNode f={f.g} depth={depth + 1} openNames={openNames} role="step g" />
              </>
            )}
            {f.k === 'min' && <DefNode f={f.f} depth={depth + 1} openNames={openNames} role="search in" />}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="rc-node leaf">
      <div className="rc-line">
        {roleEl}
        <span className="rc-toggle-space" aria-hidden="true" />
        <Tex tex={nameTex(f)} />
        {arTag}
        {f.k === 'basic' && <span className="rc-hint">a basic function of chapter 4</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ call trees

function callName(c: Call): string {
  const f = c.fn;
  if (f.k === 'comp') return '\\mathrm{Comp}';
  if (f.k === 'rec') return '\\mathrm{Rec}';
  return nameTex(f);
}

/** The calls of an evaluation, folded below the first `open` levels. */
export function CallTreeView({ root, open = 1 }: { root: Call; open?: number }) {
  return (
    <div className="rc-calls" role="group" aria-label="Call tree">
      <CallNode c={root} depth={0} open={open} />
    </div>
  );
}

const MAX_KIDS = 40;

function CallNode({ c, depth, open }: { c: Call; depth: number; open: number }): ReactNode {
  const [isOpen, setOpen] = useState(depth < open);
  const [showAll, setShowAll] = useState(false);
  const kids = showAll ? c.children : c.children.slice(0, MAX_KIDS);
  return (
    <div className="rc-call">
      <div className="rc-line">
        {c.children.length > 0 ? (
          <button className="rc-toggle" aria-expanded={isOpen} onClick={() => setOpen((o) => !o)} aria-label={isOpen ? 'fold these calls' : `show ${c.children.length} calls`}>
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="rc-toggle-space" aria-hidden="true" />
        )}
        <Tex tex={`${callName(c)}(${c.args.join(', ')}) = ${c.value === undefined ? '\\;?' : c.value.toString()}`} />
        {c.note && <span className="rc-hint">{c.note}</span>}
        {c.status === 'out-of-fuel' && <span className="rc-tag bad">unfinished</span>}
      </div>
      {isOpen && c.children.length > 0 && (
        <div className="rc-children">
          {kids.map((k) => (
            <CallNode key={k.key} c={k} depth={depth + 1} open={open} />
          ))}
          {!showAll && c.children.length > MAX_KIDS && (
            <button className="linklike small" onClick={() => setShowAll(true)}>
              show {c.children.length - MAX_KIDS} more calls
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ budgets and outcomes

export function FuelControl({ value, onChange, options, label = 'Budget' }: { value: number; onChange: (n: number) => void; options: number[]; label?: string }) {
  return (
    <div className="rc-fuel" role="group" aria-label={`${label} (function calls)`}>
      <span className="fi-label">{label}</span>
      {options.map((o) => (
        <button key={o} className="chip-btn" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o.toLocaleString('en-US')} steps
        </button>
      ))}
    </div>
  );
}

/** How to say what a bounded run found. */
export function OutcomeCell({ o, fuel, compact }: { o: PhiOutcome; fuel: number; compact?: boolean }) {
  if (o.kind === 'value') return <span className="rc-val">{o.value.toString()}</span>;
  if (o.kind === 'outOfFuel')
    return (
      <span className="rc-unknown" title={`No answer within ${fuel.toLocaleString('en-US')} steps. This does not show that there is no answer.`}>
        {compact ? '?' : `no answer within ${fuel.toLocaleString('en-US')} steps`}
      </span>
    );
  return (
    <span className="rc-na" title={o.reason}>
      {compact ? '—' : 'not a unary function'}
    </span>
  );
}

export function fmtBig(v: bigint, max = 40): string {
  const s = v.toString();
  return s.length <= max ? s : `${s.slice(0, 12)}…${s.slice(-6)} (${s.length} digits)`;
}

/** A labelled numeric input. */
export function NumField({ id, label, value, onChange, width = 90, hint }: { id: string; label: ReactNode; value: string; onChange: (s: string) => void; width?: number; hint?: string }) {
  return (
    <label className="rc-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} className="mono" value={value} onChange={(e) => onChange(e.target.value)} style={{ width }} inputMode="numeric" spellCheck={false} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && (
        <span id={`${id}-hint`} className="sr-only">
          {hint}
        </span>
      )}
    </label>
  );
}
