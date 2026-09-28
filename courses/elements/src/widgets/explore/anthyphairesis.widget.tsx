// Euclid's algorithm on lengths: take the smaller from the larger as often as possible, then
// repeat with the remainder. Drawn as squares cut from a rectangle. For commensurable lengths the
// process stops (the last square is the greatest common measure); for incommensurable ones it
// never does (X.2), which is how Euclid detects incommensurability.

import { useMemo, useState } from 'react';
import { Widget } from '../shared/Widget';

const PRESETS: { label: string; a: number; b: number; note: string }[] = [
  { label: '21 : 13', a: 21, b: 13, note: 'Consecutive Fibonacci numbers: every quotient is 1, the slowest case (Lamé).' },
  { label: '30 : 12', a: 30, b: 12, note: 'Commensurable: the process stops, and the last square, 6, measures both.' },
  { label: 'diagonal : side', a: Math.SQRT2, b: 1, note: 'The diagonal and side of a square: after the first step the quotients are 2, 2, 2, … forever. The side and diagonal are incommensurable.' },
  { label: 'φ : 1', a: (1 + Math.sqrt(5)) / 2, b: 1, note: 'The golden ratio: every quotient is 1, forever. Each rectangle left over is a smaller copy of the whole.' },
  { label: 'π : 1', a: Math.PI, b: 1, note: 'π: 3, 7, 15, 1, 292, … The large quotient 292 is why 355/113 approximates π so well.' },
];

interface Step {
  big: number;
  small: number;
  q: number;
}

function run(a: number, b: number, max = 14): { steps: Step[]; stopped: boolean } {
  const steps: Step[] = [];
  let x = Math.max(a, b);
  let y = Math.min(a, b);
  const eps = 1e-9 * Math.max(a, b);
  for (let i = 0; i < max; i++) {
    const q = Math.floor(x / y + 1e-9);
    steps.push({ big: x, small: y, q });
    const r = x - q * y;
    if (r < eps) return { steps, stopped: true };
    x = y;
    y = r;
  }
  return { steps, stopped: false };
}

export default function Anthyphairesis({ preset }: Record<string, string>) {
  const [pi, setPi] = useState(Math.max(0, PRESETS.findIndex((p) => p.label === preset)));
  const [shown, setShown] = useState(6);
  const [custom, setCustom] = useState<{ a: number; b: number } | null>(null);
  const p = custom ? { label: 'custom', a: custom.a, b: custom.b, note: '' } : PRESETS[pi];
  const { steps, stopped } = useMemo(() => run(p.a, p.b), [p.a, p.b]);
  const visible = steps.slice(0, shown);
  // draw: rectangle of width a and height b (a ≥ b), squares cut off in turn, spiralling
  const W = 560;
  const scale = W / Math.max(p.a, p.b);
  const H = Math.min(p.a, p.b) * scale;
  const squares: { x: number; y: number; s: number; i: number }[] = [];
  let x = 0;
  let y = 0;
  let w = Math.max(p.a, p.b) * scale;
  let h = Math.min(p.a, p.b) * scale;
  visible.forEach((st, i) => {
    const s = st.small * scale;
    for (let k = 0; k < st.q; k++) {
      if (w >= h - 1e-6) {
        squares.push({ x: x + k * s, y, s, i });
      } else squares.push({ x, y: y + k * s, s, i });
    }
    if (w >= h - 1e-6) {
      x += st.q * s;
      w -= st.q * s;
    } else {
      y += st.q * s;
      h -= st.q * s;
    }
  });
  const colours = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--byrne-black)'];
  const cf = steps.map((s) => s.q);
  return (
    <Widget title="Subtracting lengths (anthyphairesis)" note={p.note}>
      <div className="row">
        {PRESETS.map((q, i) => (
          <button key={q.label} className={`chip-btn ${!custom && i === pi ? 'on' : ''}`} onClick={() => (setCustom(null), setPi(i), setShown(6))}>
            {q.label}
          </button>
        ))}
        <label>
          a <input type="number" step="any" min="0.01" defaultValue={7} onChange={(e) => setCustom({ a: Math.max(0.01, Number(e.target.value) || 1), b: custom?.b ?? 5 })} style={{ width: '5em' }} />
        </label>
        <label>
          b <input type="number" step="any" min="0.01" defaultValue={5} onChange={(e) => setCustom({ a: custom?.a ?? 7, b: Math.max(0.01, Number(e.target.value) || 1) })} style={{ width: '5em' }} />
        </label>
      </div>
      <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ maxWidth: 560 }} role="img" aria-label="A rectangle cut into squares by Euclid's algorithm">
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--fig-ink)" strokeWidth={1.5} />
        {squares.map((q, k) => (
          <rect key={k} x={q.x} y={q.y} width={q.s} height={q.s} fill={colours[q.i % 4]} fillOpacity={q.i % 4 === 3 ? 0.35 : 0.75} stroke="var(--panel)" strokeWidth={Math.min(1.5, q.s / 6)} />
        ))}
      </svg>
      <div className="row">
        <label>
          steps shown <input type="range" min={1} max={steps.length} value={Math.min(shown, steps.length)} onChange={(e) => setShown(Number(e.target.value))} /> {Math.min(shown, steps.length)}
        </label>
      </div>
      <table className="gm-table">
        <thead>
          <tr>
            <th>step</th>
            <th>larger</th>
            <th>smaller</th>
            <th>times</th>
            <th>remainder</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{s.big.toPrecision(6)}</td>
              <td>{s.small.toPrecision(6)}</td>
              <td>
                <b>{s.q}</b>
              </td>
              <td>{Math.max(0, s.big - s.q * s.small).toPrecision(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Continued fraction: [{cf[0]}; {cf.slice(1).join(', ')}
        {stopped ? ']' : ', …]'} —{' '}
        {stopped ? (
          <>
            the process <b>stops</b>: the lengths are commensurable, with greatest common measure {steps[steps.length - 1].small.toPrecision(6)}.
          </>
        ) : (
          <>
            no end in sight. Floating point can only suggest this; for √2 and φ the repeating pattern of quotients proves it (X.2).
          </>
        )}
      </p>
    </Widget>
  );
}
