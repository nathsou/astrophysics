// ::application-of-areas{mode="defect"} or ::application-of-areas{mode="excess"}
// The geometric solution of x(a − x) = b² (application with defect, VI.27–28) or x(a + x) = b²
// (application with excess, VI.29), side by side with the graph of the quadratic.
import { useState, type ReactNode } from 'react';
import { Widget } from '../shared/Widget';

const W = 640;
const H = 300;

export default function ApplicationOfAreas({ mode = 'defect' }: Record<string, string>) {
  const defect = mode !== 'excess';
  const [a, setA] = useState(4);
  const [b, setB] = useState(defect ? 1.5 : 2);

  // ---- left panel: the construction, in units scaled to fit 300 × 260
  const R = Math.sqrt((a * a) / 4 + b * b); // radius of the circle in the excess case
  const u = Math.min(defect ? 290 / a : 290 / (2 * R), 55);
  const ox = defect ? 20 : 20 + (R - a / 2) * u;
  const oy = 250;
  const X = (x: number) => ox + x * u;
  const Y = (y: number) => oy - y * u;

  let roots: number[] = [];
  let construction: ReactNode;
  if (defect) {
    const disc = (a * a) / 4 - b * b;
    if (disc >= 0) roots = disc === 0 ? [a / 2] : [a / 2 - Math.sqrt(disc), a / 2 + Math.sqrt(disc)];
    const r = a / 2;
    construction = (
      <g>
        <path d={`M ${X(0)} ${Y(0)} A ${r * u} ${r * u} 0 0 1 ${X(a)} ${Y(0)}`} fill="none" stroke="var(--fig-aux)" />
        <line x1={X(0)} y1={Y(0)} x2={X(a)} y2={Y(0)} stroke="var(--fig-ink)" strokeWidth={2} />
        <line x1={X(-0.1)} y1={Y(b)} x2={X(a + 0.1)} y2={Y(b)} stroke="var(--byrne-blue)" strokeDasharray="5 4" />
        <text x={X(a + 0.15)} y={Y(b) + 4} fontSize={13} fill="var(--byrne-blue)">b</text>
        {roots.map((x, i) => (
          <g key={i}>
            <line x1={X(x)} y1={Y(0)} x2={X(x)} y2={Y(b)} stroke="var(--byrne-red)" strokeWidth={2} />
            <circle cx={X(x)} cy={Y(b)} r={4} fill="var(--byrne-red)" />
            <circle cx={X(x)} cy={Y(0)} r={3.5} fill="var(--byrne-red)" />
          </g>
        ))}
        <text x={X(0) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">A</text>
        <text x={X(a) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">B</text>
        {roots[0] !== undefined && (
          <text x={X(roots[0]) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">K</text>
        )}
      </g>
    );
  } else {
    const r = Math.sqrt((a * a) / 4 + b * b);
    const x = r - a / 2;
    roots = [x];
    construction = (
      <g>
        <path d={`M ${X(a / 2 - r)} ${Y(0)} A ${r * u} ${r * u} 0 0 1 ${X(a / 2 + r)} ${Y(0)}`} fill="none" stroke="var(--fig-aux)" />
        <line x1={X(0)} y1={Y(0)} x2={X(a)} y2={Y(0)} stroke="var(--fig-ink)" strokeWidth={2} />
        <line x1={X(a)} y1={Y(0)} x2={X(a + x)} y2={Y(0)} stroke="var(--byrne-red)" strokeWidth={3} />
        <line x1={X(a)} y1={Y(0)} x2={X(a)} y2={Y(b)} stroke="var(--byrne-blue)" strokeWidth={2} />
        <line x1={X(a / 2)} y1={Y(0)} x2={X(a)} y2={Y(b)} stroke="var(--fig-aux)" strokeDasharray="4 3" />
        <circle cx={X(a + x)} cy={Y(0)} r={4} fill="var(--byrne-red)" />
        <text x={X(0) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">A</text>
        <text x={X(a / 2) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">E</text>
        <text x={X(a) - 12} y={Y(0) + 18} fontSize={14} fontStyle="italic">B</text>
        <text x={X(a + x) - 4} y={Y(0) + 18} fontSize={14} fontStyle="italic">P</text>
        <text x={X(a) + 5} y={Y(b / 2)} fontSize={13} fill="var(--byrne-blue)">b</text>
      </g>
    );
  }

  // ---- right panel: the graph of y = x(a ∓ x) and the level b²
  const f = (x: number) => (defect ? x * (a - x) : x * (a + x));
  const xmax = defect ? a : Math.max(roots[0] * 1.4, 1);
  const ymax = Math.max(defect ? (a * a) / 4 : f(xmax), b * b) * 1.1 || 1;
  const px = (x: number) => 350 + (x / xmax) * 270;
  const py = (y: number) => 260 - (y / ymax) * 230;
  const pts = Array.from({ length: 81 }, (_, i) => (i / 80) * xmax).map((x) => `${px(x).toFixed(1)},${py(f(x)).toFixed(1)}`);

  return (
    <Widget
      title={defect ? 'Solving x(a − x) = b² with a semicircle' : 'Solving x(a + x) = b² with a circle'}
      note={
        defect
          ? 'Left: the perpendicular from the semicircle on AB down to K gives AK · KB = b² (VI.13). Right: the same equation as a graph. When b passes a/2 the level line misses the semicircle and the parabola: no solution.'
          : 'Left: with EB = a/2 and the perpendicular BT = b, the circle about E through T cuts AB produced at P, and BP · AP = ET² − EB² = b². Right: the graph. There is always exactly one positive solution.'
      }
    >
      <div className="row">
        <label>
          a <input type="range" min={2} max={6} step={0.05} value={a} onChange={(e) => setA(+e.target.value)} /> {a.toFixed(2)}
        </label>
        <label>
          b <input type="range" min={0.1} max={4} step={0.05} value={b} onChange={(e) => setB(+e.target.value)} /> {b.toFixed(2)}
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} fontFamily="var(--serif)" fill="var(--ink)">
        {construction}
        <line x1={350} y1={260} x2={625} y2={260} stroke="var(--rule-2)" />
        <line x1={350} y1={260} x2={350} y2={20} stroke="var(--rule-2)" />
        <polyline points={pts.join(' ')} fill="none" stroke="var(--fig-ink)" strokeWidth={2} />
        <line x1={350} y1={py(b * b)} x2={625} y2={py(b * b)} stroke="var(--byrne-blue)" strokeDasharray="5 4" />
        <text x={355} y={py(b * b) - 5} fontSize={13} fill="var(--byrne-blue)">y = b²</text>
        <text x={560} y={30} fontSize={13}>{defect ? 'y = x(a − x)' : 'y = x(a + x)'}</text>
        {roots.filter((x) => x <= xmax).map((x, i) => (
          <circle key={i} cx={px(x)} cy={py(b * b)} r={4} fill="var(--byrne-red)" />
        ))}
      </svg>
      <div className="row" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {defect ? (
          roots.length ? (
            <span>
              x = {roots.map((x) => x.toFixed(3)).join(' or ')} &nbsp;(a²/4 − b² = {((a * a) / 4 - b * b).toFixed(3)} ≥ 0)
            </span>
          ) : (
            <span style={{ color: 'var(--bad)' }}>no solution: b² = {(b * b).toFixed(3)} exceeds (a/2)² = {((a * a) / 4).toFixed(3)}</span>
          )
        ) : (
          <span>x = BP = {roots[0].toFixed(3)}, and x(a + x) = {(roots[0] * (a + roots[0])).toFixed(3)} = b²</span>
        )}
      </div>
    </Widget>
  );
}
