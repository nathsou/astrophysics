// Shared pieces of the computability-theory workbenches: the reader's index e (persisted across
// the sections of the chapter), big numbers, definitions, and the honest display of outcomes.

import { useMemo, useState, type ReactNode } from 'react';
import { persistedStore } from '../../ui/store';
import { Tex } from '../../ui/Tex';
import { decodeIndex, indexOf, phi, stripDefs, showDefinition, type PhiOutcome } from '../../engine/computability/indices';
import { certainlyUndefined } from '../../engine/computability/divergence';
import { rfTex, type RF } from '../../engine/recursive/rf';
import { MULTI_EXAMPLES, UNARY_EXAMPLES, type Example } from '../../engine/computability/examples';
import './ct.css';

/** The index the reader is looking at, shared by the sections of the chapter. */
export const indexStore = persistedStore<string>('ic.cmp.index', '31');
/** An input x. */
export const inputStore = persistedStore<string>('ic.cmp.input', '2');

const MAX_DIGITS = 2000;

/** Parses a natural number typed by the reader (at most 2000 digits). */
export function parseNat(s: string, maxDigits = MAX_DIGITS): bigint | null {
  const t = s.replace(/[\s,_]/g, '');
  if (!/^\d+$/.test(t) || t.length > maxDigits) return null;
  return BigInt(t);
}

const exampleIndexCache = new Map<string, bigint>();
export function exampleIndex(ex: Example): bigint {
  let e = exampleIndexCache.get(ex.id);
  if (e === undefined) exampleIndexCache.set(ex.id, (e = indexOf(ex.build())));
  return e;
}

/** A big number: all digits when short, else the first and last digits and a way to see all. */
export function Big({ n, className, max = 40 }: { n: bigint; className?: string; max?: number }) {
  const [open, setOpen] = useState(false);
  const s = n.toString();
  if (s.length <= max) return <span className={`ct-num ${className ?? ''}`}>{s}</span>;
  return (
    <span className={`ct-big ${className ?? ''}`}>
      {open ? (
        <span className="ct-digits">{s}</span>
      ) : (
        <span className="ct-num">
          {s.slice(0, 16)}…{s.slice(-8)}
        </span>
      )}{' '}
      <span className="ct-size">({s.length.toLocaleString('en-US')} digits)</span>{' '}
      <button className="linklike ct-small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'shorten' : 'all digits'}
      </button>
    </span>
  );
}

/** A definition in the notation of the recursive-functions chapter (named parts unfolded). */
export function DefinitionView({ rf, unfold = true }: { rf: RF; unfold?: boolean }) {
  const f = unfold ? stripDefs(rf) : rf;
  const tex = useMemo(() => rfTex(f), [f]);
  if (tex.length > 2500) return <code className="ct-deftext">{showDefinition(f)}</code>;
  return (
    <span className="ct-def">
      <Tex tex={tex} />
    </span>
  );
}

/** What φₑ(x) came to, keeping "value", "undefined", "no answer yet" and "not a function" apart. */
export type Status =
  | PhiOutcome
  /** undefined, for a reason the simple tests of divergence.ts can certify */
  | { kind: 'undefined'; reason: string };

/** φₑ(x) with a budget, plus a certificate of divergence when a simple one exists. */
export function phiStatus(e: bigint, x: bigint, fuel: number): Status {
  const o = phi(e, x, fuel);
  if (o.kind !== 'outOfFuel') return o;
  const d = decodeIndex(e);
  if (!d.ok) return o;
  const why = certainlyUndefined(d.rf, [x], Math.min(fuel, 2000));
  return why ? { kind: 'undefined', reason: why } : o;
}

export function OutcomeCell({ o, fuel, compact }: { o: Status; fuel: number; compact?: boolean }) {
  switch (o.kind) {
    case 'value':
      return (
        <span className="ct-o value" title={`computed with ${o.calls} function call${o.calls === 1 ? '' : 's'}`}>
          {o.value.toString()}
          {!compact && <span className="ct-calls"> {o.calls} calls</span>}
        </span>
      );
    case 'outOfFuel':
      return (
        <span className="ct-o fuel" title={`No answer within ${fuel} calls. φ may be undefined here, or need more steps.`}>
          {compact ? '…' : `no answer within ${fuel} calls`}
        </span>
      );
    case 'notAFunction':
      return (
        <span className="ct-o notfn" title={`Not a unary function: ${o.reason}`}>
          {compact ? '×' : 'not a function'}
        </span>
      );
    case 'undefined':
      return (
        <span className="ct-o undef" title={`Undefined: ${o.reason}`}>
          {compact ? '↑' : 'undefined'}
        </span>
      );
  }
}

export function OutcomeLegend({ fuel, withUndefined = true }: { fuel: number; withUndefined?: boolean }) {
  return (
    <ul className="ct-legend" aria-label="Legend">
      <li>
        <span className="ct-o value">7</span> a value: the computation halted
      </li>
      {withUndefined && (
        <li>
          <span className="ct-o undef">↑</span> undefined, for a reason simple enough to check
        </li>
      )}
      <li>
        <span className="ct-o fuel">…</span> no answer within {fuel} calls: nothing is known
      </li>
      <li>
        <span className="ct-o notfn">×</span> e is not a unary definition: no computation exists
      </li>
    </ul>
  );
}

/** The fuel slider shared by the workbenches. */
export function FuelControl({ fuel, setFuel, max = 20_000, min = 10 }: { fuel: number; setFuel: (n: number) => void; max?: number; min?: number }) {
  const steps = [10, 30, 100, 300, 1000, 3000, 10_000, 20_000, 50_000].filter((v) => v >= min && v <= max);
  const i = Math.max(0, steps.findIndex((v) => v >= fuel));
  return (
    <label className="ct-fuel">
      <span>budget</span>
      <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => setFuel(steps[Number(e.target.value)])} aria-valuetext={`${steps[i]} function calls`} />
      <span className="ct-num">{steps[i].toLocaleString('en-US')} calls</span>
    </label>
  );
}

/** Picks an index: typed, stepped, or chosen from examples. */
export function IndexPicker({
  value,
  onChange,
  label = 'index e',
  examples = 'unary',
  id,
  next = 'unary',
}: {
  value: string;
  onChange: (s: string) => void;
  label?: ReactNode;
  examples?: 'unary' | 'multi' | 'all' | 'none';
  id?: string;
  /** what the "next" button looks for: a one-place definition, or one of two or more places */
  next?: 'unary' | 'multi';
}) {
  const e = parseNat(value);
  const exs = examples === 'unary' ? UNARY_EXAMPLES : examples === 'multi' ? MULTI_EXAMPLES : examples === 'all' ? [...UNARY_EXAMPLES, ...MULTI_EXAMPLES] : [];
  const inputId = id ?? 'ct-index';
  const nextUnary = (from: bigint, dir: 1n | -1n) => {
    for (let k = from + dir, n = 0; k >= 0n && n < 20_000; k += dir, n++) {
      const d = decodeIndex(k);
      if (d.ok && (next === 'unary' ? d.arity === 1 : d.arity >= 2)) return k;
    }
    return null;
  };
  return (
    <div className="ct-picker">
      <label className="fi-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="ct-picker-row">
        <input id={inputId} className={`fi-field mono ct-index-field ${e === null ? 'invalid' : ''}`} value={value} onChange={(ev) => onChange(ev.target.value)} inputMode="numeric" spellCheck={false} aria-invalid={e === null} />
        <button className="chip-btn" disabled={e === null || e === 0n} onClick={() => e !== null && onChange((e - 1n).toString())} aria-label="previous index">
          −1
        </button>
        <button className="chip-btn" disabled={e === null} onClick={() => e !== null && onChange((e + 1n).toString())} aria-label="next index">
          +1
        </button>
        <button
          className="chip-btn"
          disabled={e === null}
          onClick={() => {
            if (e === null) return;
            const k = nextUnary(e, 1n);
            if (k !== null) onChange(k.toString());
          }}
          title={next === 'unary' ? 'the next index of a well-formed one-place definition' : 'the next index of a well-formed definition with two or more places'}
        >
          {next === 'unary' ? 'next unary →' : 'next with ≥ 2 places →'}
        </button>
        {exs.length > 0 && (
          <select
            className="fi-examples"
            aria-label="examples"
            value=""
            onChange={(ev) => {
              const ex = exs.find((x) => x.id === ev.target.value);
              if (ex) onChange(exampleIndex(ex).toString());
            }}
          >
            <option value="">examples…</option>
            {exs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {e === null && <p className="fi-error">Type a natural number (at most {MAX_DIGITS} digits).</p>}
    </div>
  );
}

/** What an index decodes to, in words. */
export function IndexSummary({ e, want = 1 }: { e: bigint; want?: number }) {
  const d = useMemo(() => decodeIndex(e), [e]);
  if (!d.ok)
    return (
      <div className="ct-summary">
        <p className="wb-note">
          <b>Not a well-formed definition.</b> {d.errors.join('; ')}. In this edition’s coding every number is the code of a definition <i>tree</i>, but not every tree
          is a definition. No computation of it exists, so <Tex tex={`\\varphi_{${e.toString().length > 12 ? 'e' : e}}(x)`} /> is undefined for every <Tex tex="x" />.
        </p>
        {d.rf && (
          <p className="ct-scroll">
            <code className="ct-deftext">{showDefinition(d.rf)}</code>
          </p>
        )}
      </div>
    );
  return (
    <div className="ct-summary">
      <p className="ct-scroll">
        <DefinitionView rf={d.rf} />
      </p>
      <p className="wb-note">
        A well-formed definition of a {d.arity}-place function.
        {want === 1 && d.arity !== 1 && <> Only one-place definitions count as <Tex tex="\varphi_e" />: for this e, <Tex tex="\varphi_e(x)" /> is undefined for every x.</>}
      </p>
    </div>
  );
}
