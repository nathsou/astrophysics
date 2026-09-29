// ::euclid-algorithm{a="36" b="15"}
// Euclid's algorithm on two rods, step by step: Euclid's subtractive form (VII.1–2), where the less
// number is taken from the greater one subtraction at a time, or the division form, where each
// step removes as many copies as fit at once. Shows the trace and the number of steps; the
// Fibonacci button loads Lamé's worst case.

import { useEffect, useMemo, useState } from 'react';
import { Widget } from '../shared/Widget';

type Mode = 'subtractive' | 'division';

interface Step {
  /** The pair before the step (greater first). */
  x: number;
  y: number;
  /** How many copies of y the step removes from x (1 in the subtractive form). */
  q: number;
  /** The pair after the step, greater first; y = 0 marks the end of the division form. */
  nx: number;
  ny: number;
}

const ordered = (a: number, b: number): [number, number] => (a >= b ? [a, b] : [b, a]);

/** Euclid's form: take the less from the greater until the two are equal. */
export function subtractive(a: number, b: number): Step[] {
  const out: Step[] = [];
  let [x, y] = ordered(a, b);
  while (x !== y) {
    const [nx, ny] = ordered(x - y, y);
    out.push({ x, y, q: 1, nx, ny });
    [x, y] = [nx, ny];
  }
  return out;
}

/** The division form: replace (x, y) by (y, x mod y) until the remainder is 0. */
export function division(a: number, b: number): Step[] {
  const out: Step[] = [];
  let [x, y] = ordered(a, b);
  while (y !== 0) {
    const q = Math.floor(x / y);
    const r = x % y;
    out.push({ x, y, q, nx: y, ny: r });
    [x, y] = [y, r];
  }
  return out;
}

const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
const MAX = 144;

function Rod({ y, n, unit, label, parts }: { y: number; n: number; unit: number; label: string; parts: { from: number; to: number; colour: string }[] }) {
  const x0 = 34;
  const ticks = unit >= 3.5 ? Array.from({ length: n + 1 }, (_, i) => i) : [0, n];
  return (
    <g>
      <text x={x0 - 10} y={y + 5} textAnchor="end" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, fill: 'var(--ink-2)' }}>
        {label}
      </text>
      <line x1={x0} y1={y} x2={x0 + n * unit} y2={y} style={{ stroke: 'var(--fig-ink)', strokeWidth: 2 }} />
      {parts.map((p, i) => (
        <line key={i} x1={x0 + p.from * unit} y1={y} x2={x0 + p.to * unit} y2={y} style={{ stroke: p.colour, strokeWidth: 7, strokeOpacity: 0.85 }} />
      ))}
      {ticks.map((i) => (
        <line key={i} x1={x0 + i * unit} y1={y - 4} x2={x0 + i * unit} y2={y + 4} style={{ stroke: 'var(--fig-ink)', strokeWidth: 1 }} />
      ))}
      <text x={x0 + n * unit + 8} y={y + 5} style={{ fontFamily: 'var(--sans)', fontSize: 13, fill: 'var(--muted)' }}>
        {n}
      </text>
    </g>
  );
}

export default function EuclidAlgorithm(props: Record<string, string>) {
  const [a, setA] = useState(() => Math.min(MAX, Math.max(1, Number(props.a) || 36)));
  const [b, setB] = useState(() => Math.min(MAX, Math.max(1, Number(props.b) || 15)));
  const [mode, setMode] = useState<Mode>(props.mode === 'division' ? 'division' : 'subtractive');
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  const steps = useMemo(() => (mode === 'subtractive' ? subtractive(a, b) : division(a, b)), [a, b, mode]);
  const other = useMemo(() => (mode === 'subtractive' ? division(a, b) : subtractive(a, b)), [a, b, mode]);
  const done = i >= steps.length;
  const g = steps.length ? steps[steps.length - 1].nx : a;

  useEffect(() => setI(0), [a, b, mode]);
  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((k) => k + 1), mode === 'subtractive' && steps.length > 30 ? 250 : 800);
    return () => clearTimeout(t);
  }, [playing, i, done, mode, steps.length]);

  // the current pair, and what the next step removes
  const [x, y] = done ? (steps.length ? [steps[steps.length - 1].nx, steps[steps.length - 1].ny] : ordered(a, b)) : [steps[i].x, steps[i].y];
  const unit = 520 / Math.max(a, b);
  const red = 'var(--byrne-red)';
  const blue = 'var(--byrne-blue)';
  const top: { from: number; to: number; colour: string }[] = [];
  if (!done) {
    const s = steps[i];
    // copies of y taken from the far end of x; the remainder stays at the start
    top.push({ from: x - s.q * y, to: x, colour: red });
    if (x - s.q * y > 0) top.push({ from: 0, to: x - s.q * y, colour: blue });
  }
  const bottom = !done && y > 0 ? [{ from: 0, to: y, colour: red }] : [];

  const describe = (s: Step) => (mode === 'subtractive' ? `${s.x} − ${s.y} = ${s.x - s.y}` : `${s.x} = ${s.q}·${s.y} + ${s.ny}`);
  const fibPair = () => {
    const k = FIB.length - 1;
    setA(FIB[k - 1]);
    setB(FIB[k - 2]);
  };

  const btn = (label: string, on: () => void, disabled = false, active = false) => (
    <button className={`chip-btn ${active ? 'on' : ''}`} onClick={on} disabled={disabled} style={disabled ? { opacity: 0.45, cursor: 'default' } : undefined}>
      {label}
    </button>
  );

  return (
    <Widget title="Euclid's algorithm">
      <div className="row">
        <label>
          <i>AB</i>
          <input type="range" min={1} max={MAX} value={a} onChange={(e) => setA(Number(e.target.value))} />
          <span style={{ minWidth: '2.2em', fontVariantNumeric: 'tabular-nums' }}>{a}</span>
        </label>
        <label>
          <i>CD</i>
          <input type="range" min={1} max={MAX} value={b} onChange={(e) => setB(Number(e.target.value))} />
          <span style={{ minWidth: '2.2em', fontVariantNumeric: 'tabular-nums' }}>{b}</span>
        </label>
      </div>
      <div className="row">
        {btn('Subtraction (Euclid)', () => setMode('subtractive'), false, mode === 'subtractive')}
        {btn('Division', () => setMode('division'), false, mode === 'division')}
        <span style={{ flex: 1 }} />
        {btn('Fibonacci 89, 55', fibPair)}
      </div>
      <svg viewBox="0 0 600 96" role="img" aria-label={`Rods of ${x} and ${y} units`}>
        <Rod y={30} n={x} unit={unit} label="x" parts={top} />
        {y > 0 && <Rod y={70} n={y} unit={unit} label="y" parts={bottom} />}
      </svg>
      <div className="row">
        {btn('⟲ Reset', () => {
          setPlaying(false);
          setI(0);
        })}
        {btn('◀ Back', () => setI((k) => Math.max(0, k - 1)), i === 0)}
        {btn(playing ? '❚❚ Pause' : '▶ Play', () => setPlaying((p) => !p), done && !playing)}
        {btn('Step ▶', () => setI((k) => Math.min(steps.length, k + 1)), done)}
        <span style={{ marginLeft: 'auto', color: 'var(--ink-2)' }}>
          step {Math.min(i, steps.length)} of {steps.length}
          {done && (
            <>
              {' '}
              · gcd = <b>{g}</b>
              {g === 1 ? ' (prime to one another, VII.1)' : ''}
            </>
          )}
        </span>
      </div>
      <ol
        style={{
          margin: '6px 0 0',
          paddingLeft: '2.2em',
          maxHeight: steps.length > 14 ? 240 : undefined,
          overflowY: 'auto',
          fontVariantNumeric: 'tabular-nums',
          columns: steps.length > 14 ? 3 : steps.length > 6 ? 2 : 1,
          fontSize: 13.5,
        }}
      >
        {steps.map((s, k) => (
          <li key={k} style={{ opacity: k < i ? 1 : 0.35, fontWeight: k === i ? 600 : 400 }}>
            {describe(s)}
          </li>
        ))}
      </ol>
      <p style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>
        {mode === 'subtractive' ? 'Subtractions' : 'Divisions'}: {steps.length}. The {mode === 'subtractive' ? 'division' : 'subtractive'} form takes {other.length}.
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
        Red: what the next step takes away (in the division form, every copy that fits at once). Blue: what is left. Euclid's form stops when the two numbers are equal; the division form stops at remainder 0.
        Consecutive Fibonacci numbers make every quotient 1, which is the slowest case of the division form (Lamé, 1844).
      </p>
    </Widget>
  );
}
