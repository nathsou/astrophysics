// The method of exhaustion (X.1, XII.2): inscribe a square in a circle, then double the number of
// sides again and again. Each doubling adds triangles that are more than half of the circular
// segments they stand on, so the part of the circle left uncovered more than halves each time and
// can be made smaller than any given magnitude.

import { useState } from 'react';
import { Widget } from '../shared/Widget';

export default function Exhaustion() {
  const [k, setK] = useState(1);
  const R = 150;
  const cx = 170;
  const cy = 170;
  const poly = (n: number) => Array.from({ length: n }, (_, i) => [cx + R * Math.cos(Math.PI / 2 + (2 * Math.PI * i) / n), cy - R * Math.sin(Math.PI / 2 + (2 * Math.PI * i) / n)]);
  const n = 4 * 2 ** k;
  const area = (m: number) => (m / 2) * Math.sin((2 * Math.PI) / m);
  const rows = Array.from({ length: 8 }, (_, j) => {
    const m = 4 * 2 ** j;
    const gap = Math.PI - area(m);
    const prevGap = j > 0 ? Math.PI - area(m / 2) : null;
    return { m, a: area(m), gap, ratio: prevGap ? gap / prevGap : null };
  });
  const prev = poly(n / 2);
  const cur = poly(n);
  return (
    <Widget title="Exhausting a circle" note="The ratio of successive gaps is always below ½ and tends to ¼. X.1 only needs “more than half removed each time” to conclude that the gap can be made smaller than any given area. XII.2 then shows by double reductio that circles are as the squares on their diameters.">
      <div className="row">
        <label>
          sides <input type="range" min={0} max={5} value={k} onChange={(e) => setK(Number(e.target.value))} /> {n}
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <svg viewBox="0 0 340 340" role="img" aria-label={`A regular ${n}-gon inscribed in a circle`}>
          <circle cx={cx} cy={cy} r={R} fill="color-mix(in srgb, var(--byrne-red) 22%, transparent)" stroke="var(--fig-ink)" strokeWidth={1.5} />
          <polygon points={cur.map((p) => p.join(',')).join(' ')} fill="var(--byrne-yellow)" fillOpacity={0.85} stroke="var(--fig-ink)" strokeWidth={1} />
          {k > 0 && <polygon points={prev.map((p) => p.join(',')).join(' ')} fill="var(--byrne-blue)" fillOpacity={0.55} stroke="var(--fig-ink)" strokeWidth={1.2} />}
        </svg>
        <table className="gm-table">
          <thead>
            <tr>
              <th>sides</th>
              <th>polygon (r = 1)</th>
              <th>gap to π</th>
              <th>gap ÷ previous</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, j) => (
              <tr key={r.m} style={{ fontWeight: j === k ? 700 : 400 }}>
                <td>{r.m}</td>
                <td>{r.a.toFixed(6)}</td>
                <td>{r.gap.toExponential(3)}</td>
                <td>{r.ratio === null ? '' : r.ratio.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Blue: the polygon before doubling. Yellow: the triangles added, each more than half of the segment of the circle it stands on. Red: what is left.
      </p>
    </Widget>
  );
}
