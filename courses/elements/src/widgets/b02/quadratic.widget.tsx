// ::quadratic{mode="5"} or ::quadratic{mode="6"}: solving a quadratic with the gnomon of II.5 or II.6.
// II.5: x(b − x) = c. The gnomon inside the square on half of b has area c; what is left is the
//       square on (b/2 − x), so x = b/2 − √((b/2)² − c).
// II.6: x(b + x) = c. The gnomon is the square on (b/2 + x) minus the square on b/2, so
//       x = √((b/2)² + c) − b/2.
import { useState } from 'react';
import { Widget } from '../shared/Widget';

const fmt = (x: number) => (Math.abs(x) < 1e-9 ? '0' : x.toFixed(3));

export default function Quadratic({ mode: initial = '6' }: Record<string, string>) {
  const [mode, setMode] = useState(initial === '5' ? '5' : '6');
  const [b, setB] = useState(4);
  const [c, setC] = useState(mode === '5' ? 3 : 5);
  const h = b / 2;
  // side of the big square (S) and of the square taken away (s); the gnomon between them has area c
  let S: number;
  let s: number;
  let x: number | null;
  if (mode === '5') {
    S = h;
    const d = h * h - c;
    s = d >= 0 ? Math.sqrt(d) : 0;
    x = d >= 0 ? h - s : null;
  } else {
    s = h;
    S = Math.sqrt(h * h + c);
    x = S - h;
  }
  const W = 240;
  const H = 250;
  const scale = 200 / Math.max(S, 1);
  const ox = 20;
  const oy = 20;
  const big = S * scale;
  const small = s * scale;
  // the gnomon: the big square minus the small square in its lower-left corner
  const gn = `M${ox},${oy} H${ox + big} V${oy + big} H${ox + small} V${oy + big - small} H${ox} Z`;
  return (
    <Widget
      title={mode === '5' ? 'Solving x(b − x) = c with II.5' : 'Solving x(b + x) = c with II.6'}
      note={
        mode === '5'
          ? 'The gnomon has area c; the square left over is (b/2 − x)². If c > (b/2)², the gnomon cannot fit and there is no solution: this is the limit (diorism) Euclid states in VI.27.'
          : 'The gnomon has area c and wraps round the square on b/2; the whole is a square on b/2 + x, whose side can always be found (I.47), so there is always exactly one positive solution.'
      }
    >
      <div className="row">
        <label>
          <input type="radio" checked={mode === '5'} onChange={() => setMode('5')} /> II.5
        </label>
        <label>
          <input type="radio" checked={mode === '6'} onChange={() => setMode('6')} /> II.6
        </label>
        <label>
          b <input type="range" min={1} max={8} step={0.1} value={b} onChange={(e) => setB(Number(e.target.value))} /> {b.toFixed(1)}
        </label>
        <label>
          c <input type="range" min={0.1} max={16} step={0.1} value={c} onChange={(e) => setC(Number(e.target.value))} /> {c.toFixed(1)}
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The gnomon of area c" style={{ maxWidth: 280, margin: '0 auto' }}>
        {(mode === '6' || x !== null) && <path d={gn} style={{ fill: 'var(--fig-fill)', stroke: 'var(--fig-ink)', strokeWidth: 1.5 }} />}
        {mode === '5' && x === null && <rect x={ox} y={oy} width={big} height={big} style={{ fill: 'none', stroke: 'var(--bad)', strokeWidth: 1.5 }} />}
        {small > 0 && <rect x={ox} y={oy + big - small} width={small} height={small} style={{ fill: 'none', stroke: 'var(--fig-aux)', strokeWidth: 1, strokeDasharray: '4 3' }} />}
        <text x={ox + big / 2} y={oy + big + 16} textAnchor="middle" style={{ fill: 'var(--ink-2)', fontSize: 13 }}>
          {mode === '5' ? 'b/2' : 'b/2 + x'}
        </text>
        {small > 12 && (
          <text x={ox + small / 2} y={oy + big - small / 2} textAnchor="middle" dy="0.35em" style={{ fill: 'var(--muted)', fontSize: 12 }}>
            {mode === '5' ? '(b/2 − x)²' : '(b/2)²'}
          </text>
        )}
      </svg>
      <p>
        Gnomon = c = {c.toFixed(1)}. {x === null ? 'No solution: c > (b/2)².' : `x = ${fmt(x)}; check: x(${mode === '5' ? 'b − x' : 'b + x'}) = ${fmt(x * (mode === '5' ? b - x : b + x))}.`}
      </p>
    </Widget>
  );
}
