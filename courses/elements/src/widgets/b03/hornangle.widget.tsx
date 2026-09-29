// III.16: the horn angle between a circle and its tangent. However small the rectilineal angle θ,
// the line at angle θ to the tangent enters the circle, leaving it again at P. The view zooms to
// keep P in frame; the picture looks the same at every scale.
import { useState } from 'react';
import { Widget } from '../shared/Widget';

const W = 520;
const H = 240;

export default function HornAngle() {
  const [s, setS] = useState(0.35); // slider position; θ = 10^(s·4 − 2.3) degrees
  const deg = Math.pow(10, s * 4 - 2.3);
  const th = (deg * Math.PI) / 180;
  // circle of radius 1 tangent to the x-axis at A = (0, 0), centre (0, 1)
  const px = Math.sin(2 * th) / 2 * 2; // x of P = 2 sin θ cos θ
  const py = 2 * Math.sin(th) ** 2;
  const x0 = -0.45 * px;
  const x1 = 1.55 * px;
  const y0 = -0.25 * py;
  const y1 = 2.1 * py;
  const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const Y = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
  const circ: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = x0 + ((x1 - x0) * i) / 200;
    const y = (x * x) / (1 + Math.sqrt(Math.max(0, 1 - x * x))); // 1 − √(1 − x²), without cancellation
    circ.push(`${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
  }
  const exag = (x1 - x0) / W / ((y1 - y0) / H);
  return (
    <Widget
      title="The angle of contact is smaller than every rectilineal angle"
      note={
        <>
          A line through A at angle θ to the tangent always re-enters the circle and leaves it at P, at distance 2 sin θ from A (radius 1).
          Push θ down: the view zooms in to keep P in frame, and the picture never changes shape. No θ &gt; 0 fits between the tangent and the circle.
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', background: 'var(--paper-2)', borderRadius: 8 }}>
        <line x1={0} y1={Y(0)} x2={W} y2={Y(0)} stroke="var(--byrne-blue)" strokeWidth={2} />
        <polyline points={circ.join(' ')} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <line x1={X(x0)} y1={Y(x0 * Math.tan(th))} x2={X(x1)} y2={Y(x1 * Math.tan(th))} stroke="var(--byrne-red)" strokeWidth={2} />
        <circle cx={X(0)} cy={Y(0)} r={4} fill="var(--ink)" />
        <circle cx={X(px)} cy={Y(py)} r={4} fill="var(--byrne-red)" />
        <text x={X(0) - 6} y={Y(0) + 18} fontSize={14} fill="var(--ink)" fontStyle="italic">A</text>
        <text x={X(px) + 6} y={Y(py) - 6} fontSize={14} fill="var(--byrne-red)" fontStyle="italic">P</text>
        <text x={W - 8} y={Y(0) - 6} fontSize={12} fill="var(--byrne-blue)" textAnchor="end">tangent</text>
      </svg>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <span>θ</span>
        <input type="range" min={0} max={1} step={0.001} value={s} onChange={(e) => setS(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>{deg < 0.1 ? deg.toExponential(2) : deg.toFixed(3)}°</span>
      </label>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
        Width of view: {(x1 - x0).toExponential(2)} radii. Vertical scale exaggerated ×{exag.toFixed(exag < 10 ? 1 : 0)}.
      </p>
    </Widget>
  );
}
