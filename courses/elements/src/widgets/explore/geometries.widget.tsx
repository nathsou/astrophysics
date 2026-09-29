// The same triangle in three geometries: Euclidean, hyperbolic (Poincaré disk) and spherical.
// Drag the vertices; compare the angle sums; switch to "parallels" to see Postulate 5 hold,
// fail one way (many parallels), or fail the other way (none).

import { useRef, useState } from 'react';
import { Widget } from '../shared/Widget';
import { circumcircle, v, type V } from '../../geometry/vec';

type Mode = 'triangle' | 'parallels';
const S = 150; // pixels per unit in each panel
const deg = (r: number) => (r * 180) / Math.PI;
const fmt = (x: number) => x.toFixed(1);

// ---------------------------------------------------------------- hyperbolic (Poincaré disk)

function geodesic(p: V, q: V): { kind: 'line' } | { kind: 'circle'; c: V; r: number } {
  const cr = p.x * q.y - p.y * q.x;
  if (Math.abs(cr) < 1e-9) return { kind: 'line' };
  const n2 = p.x * p.x + p.y * p.y;
  const inv = n2 > 1e-12 ? v(p.x / n2, p.y / n2) : null;
  if (!inv) return { kind: 'line' };
  const k = circumcircle(p, q, inv);
  return { kind: 'circle', ...k };
}

/** SVG path of the geodesic segment from p to q (disk coordinates, y up; centre of the panel at (cx, cy)). */
function hypSegPath(p: V, q: V, cx: number, cy: number): string {
  const P = v(cx + p.x * S, cy - p.y * S);
  const Q = v(cx + q.x * S, cy - q.y * S);
  const g = geodesic(p, q);
  if (g.kind === 'line') return `M${P.x},${P.y} L${Q.x},${Q.y}`;
  const r = g.r * S;
  // choose the arc whose midpoint lies inside the disk
  const a0 = Math.atan2(p.y - g.c.y, p.x - g.c.x);
  let a1 = Math.atan2(q.y - g.c.y, q.x - g.c.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  a1 = a0 + d;
  const sweep = d > 0 ? 0 : 1; // y is flipped on screen
  return `M${P.x},${P.y} A${r},${r} 0 0 ${sweep} ${Q.x},${Q.y}`;
}

/** A closed path around the hyperbolic triangle (for filling). */
function hypTriPath(ps: V[], cx: number, cy: number): string {
  return ps.map((p, i) => hypSegPath(p, ps[(i + 1) % ps.length], cx, cy).replace(/^M[^A-Z]*(?=[AL])/, i === 0 ? (m) => m : () => '')).join(' ') + ' Z';
}

/** Unit tangent at p of the geodesic from p towards q. */
function hypTangent(p: V, q: V): V {
  const g = geodesic(p, q);
  let t: V;
  if (g.kind === 'line') t = v(q.x - p.x, q.y - p.y);
  else {
    t = v(-(p.y - g.c.y), p.x - g.c.x);
    if (t.x * (q.x - p.x) + t.y * (q.y - p.y) < 0) t = v(-t.x, -t.y);
  }
  const l = Math.hypot(t.x, t.y);
  return v(t.x / l, t.y / l);
}
const angleBetween = (a: V, b: V) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));

/** The two ideal points (on the unit circle) of the geodesic through p and q. */
function idealPoints(p: V, q: V): [V, V] {
  const g = geodesic(p, q);
  if (g.kind === 'line') {
    const d = v(q.x - p.x, q.y - p.y);
    const l = Math.hypot(d.x, d.y);
    // line through p with direction d meets the unit circle
    const u = v(d.x / l, d.y / l);
    const b = p.x * u.x + p.y * u.y;
    const c = p.x * p.x + p.y * p.y - 1;
    const s = Math.sqrt(b * b - c);
    return [v(p.x + u.x * (-b - s), p.y + u.y * (-b - s)), v(p.x + u.x * (-b + s), p.y + u.y * (-b + s))];
  }
  // intersect circle (c, r) with the unit circle
  const d = Math.hypot(g.c.x, g.c.y);
  const a = (1 - g.r * g.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, 1 - a * a));
  const e = v(g.c.x / d, g.c.y / d);
  const m = v(e.x * a, e.y * a);
  return [v(m.x - e.y * h, m.y + e.x * h), v(m.x + e.y * h, m.y - e.x * h)];
}

/** A long geodesic segment through p and q, reaching (almost) the boundary on both sides. */
function hypLinePath(p: V, q: V, cx: number, cy: number): string {
  const [i1, i2] = idealPoints(p, q);
  const shrink = (x: V) => v(x.x * 0.999, x.y * 0.999);
  return hypSegPath(shrink(i1), shrink(i2), cx, cy);
}

// ---------------------------------------------------------------- spherical

type V3 = [number, number, number];
const norm3 = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rotX = (a: V3, t: number): V3 => [a[0], a[1] * Math.cos(t) - a[2] * Math.sin(t), a[1] * Math.sin(t) + a[2] * Math.cos(t)];
const VIEW_TILT = -0.35;
const view = (a: V3): V3 => rotX(a, VIEW_TILT);
const unview = (a: V3): V3 => rotX(a, -VIEW_TILT);
function slerp(a: V3, b: V3, t: number): V3 {
  const om = Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));
  if (om < 1e-9) return a;
  const s = Math.sin(om);
  const k1 = Math.sin((1 - t) * om) / s;
  const k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}
function sphAngle(a: V3, b: V3, c: V3): number {
  const t1 = norm3([b[0] - dot3(a, b) * a[0], b[1] - dot3(a, b) * a[1], b[2] - dot3(a, b) * a[2]]);
  const t2 = norm3([c[0] - dot3(a, c) * a[0], c[1] - dot3(a, c) * a[1], c[2] - dot3(a, c) * a[2]]);
  return Math.acos(Math.max(-1, Math.min(1, dot3(t1, t2))));
}
/** Polyline pieces of a great-circle path through points, split into front (z ≥ 0) and back. */
function sphPath(pts: V3[], cx: number, cy: number): { front: string; back: string } {
  let front = '';
  let back = '';
  let prevFront: boolean | null = null;
  for (const p of pts) {
    const q = view(p);
    const isFront = q[2] >= 0;
    const X = cx + q[0] * S;
    const Y = cy - q[1] * S;
    if (isFront) front += `${prevFront === true ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `;
    else back += `${prevFront === false ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `;
    prevFront = isFront;
  }
  return { front, back };
}
const arcPts = (a: V3, b: V3, n = 40) => Array.from({ length: n + 1 }, (_, i) => slerp(a, b, i / n));
const greatCircle = (a: V3, b: V3, n = 160): V3[] => {
  const nrm = norm3(cross3(a, b));
  const u = norm3(a);
  const w = cross3(nrm, u);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return [u[0] * Math.cos(t) + w[0] * Math.sin(t), u[1] * Math.cos(t) + w[1] * Math.sin(t), u[2] * Math.cos(t) + w[2] * Math.sin(t)] as V3;
  });
};

// ---------------------------------------------------------------- the widget

export default function Geometries({ mode: initial }: Record<string, string>) {
  const [mode, setMode] = useState<Mode>(initial === 'parallels' ? 'parallels' : 'triangle');
  const [E, setE] = useState<V[]>([v(-0.8, -0.55), v(0.85, -0.5), v(0.05, 0.8)]);
  const [Hy, setHy] = useState<V[]>([v(-0.62, -0.42), v(0.66, -0.38), v(0.02, 0.66)]);
  const [Sp, setSp] = useState<V3[]>([norm3([-0.55, -0.3, 0.78]), norm3([0.6, -0.28, 0.75]), norm3([0.02, 0.62, 0.78])]);
  const drag = useRef<{ panel: 0 | 1 | 2; i: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const PW = 2 * S + 40;
  const centres = [v(PW / 2, S + 30), v(PW * 1.5, S + 30), v(PW * 2.5, S + 30)];

  const local = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return v(((e.clientX - r.left) / r.width) * PW * 3, ((e.clientY - r.top) / r.height) * (2 * S + 90));
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const m = local(e);
    const c = centres[d.panel];
    const p = v((m.x - c.x) / S, (c.y - m.y) / S);
    if (d.panel === 0) setE(E.map((q, i) => (i === d.i ? v(Math.max(-1.1, Math.min(1.1, p.x)), Math.max(-1, Math.min(1, p.y))) : q)));
    else if (d.panel === 1) {
      const l = Math.hypot(p.x, p.y);
      const pp = l > 0.97 ? v((p.x / l) * 0.97, (p.y / l) * 0.97) : p;
      setHy(Hy.map((q, i) => (i === d.i ? pp : q)));
    } else {
      const l = Math.hypot(p.x, p.y);
      const pp = l > 0.999 ? v((p.x / l) * 0.999, (p.y / l) * 0.999) : p;
      const z = Math.sqrt(Math.max(0, 1 - pp.x * pp.x - pp.y * pp.y));
      setSp(Sp.map((q, i) => (i === d.i ? norm3(unview([pp.x, pp.y, z])) : q)));
    }
  };
  const handle = (panel: 0 | 1 | 2, i: number, P: V, label: string) => (
    <g key={`${panel}${i}`} className="gm-pt" onPointerDown={(e) => ((drag.current = { panel, i }), (e.target as SVGElement).setPointerCapture?.(e.pointerId))}>
      <circle cx={P.x} cy={P.y} r={12} className="hit" />
      <circle cx={P.x} cy={P.y} r={4.5} className="dot" />
      <text x={P.x + 8} y={P.y - 8} className="lbl">
        {label}
      </text>
    </g>
  );

  // --- Euclidean
  const eP = E.map((p) => v(centres[0].x + p.x * S, centres[0].y - p.y * S));
  const eAng = [0, 1, 2].map((i) => {
    const a = E[i];
    const b = E[(i + 1) % 3];
    const c = E[(i + 2) % 3];
    const u = v(b.x - a.x, b.y - a.y);
    const w = v(c.x - a.x, c.y - a.y);
    return Math.acos((u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)));
  });
  // --- hyperbolic
  const hc = centres[1];
  const hAng = [0, 1, 2].map((i) => angleBetween(hypTangent(Hy[i], Hy[(i + 1) % 3]), hypTangent(Hy[i], Hy[(i + 2) % 3])));
  // --- spherical
  const sc = centres[2];
  const sAng = [0, 1, 2].map((i) => sphAngle(Sp[i], Sp[(i + 1) % 3], Sp[(i + 2) % 3]));
  const sumE = deg(eAng.reduce((a, b) => a + b, 0));
  const sumH = deg(hAng.reduce((a, b) => a + b, 0));
  const sumS = deg(sAng.reduce((a, b) => a + b, 0));
  const names = ['A', 'B', 'C'];

  const sphPt = (p: V3) => {
    const q = view(p);
    return { P: v(sc.x + q[0] * S, sc.y - q[1] * S), front: q[2] >= 0 };
  };

  return (
    <Widget
      title="Three geometries"
      note={
        mode === 'triangle'
          ? 'Drag the vertices. The Euclidean angle sum is always 180°. In the hyperbolic plane it is less (the defect is the area); on the sphere it is more (the excess is the area).'
          : 'Through C, parallels to the line AB. Euclidean: exactly one (Playfair’s form of Postulate 5). Hyperbolic: infinitely many; the two limiting ones are drawn. Spherical: none, since every two great circles meet.'
      }
    >
      <div className="row">
        <div className="seg">
          <button className={mode === 'triangle' ? 'on' : ''} onClick={() => setMode('triangle')}>Triangle</button>
          <button className={mode === 'parallels' ? 'on' : ''} onClick={() => setMode('parallels')}>Parallels</button>
        </div>
        <button className="chip-btn" onClick={() => (setE([v(-0.8, -0.55), v(0.85, -0.5), v(0.05, 0.8)]), setHy([v(-0.62, -0.42), v(0.66, -0.38), v(0.02, 0.66)]), setSp([norm3([-0.55, -0.3, 0.78]), norm3([0.6, -0.28, 0.75]), norm3([0.02, 0.62, 0.78])]))}>
          Reset
        </button>
      </div>
      <svg ref={svg} viewBox={`0 0 ${PW * 3} ${2 * S + 90}`} className="geometries" onPointerMove={onMove} onPointerUp={() => (drag.current = null)} style={{ touchAction: 'none' }}>
        {/* Euclidean */}
        <rect x={centres[0].x - S - 10} y={centres[0].y - S - 10} width={2 * S + 20} height={2 * S + 20} className="gm-frame" rx={8} />
        {mode === 'triangle' ? (
          <polygon points={eP.map((p) => `${p.x},${p.y}`).join(' ')} className="gm-tri" />
        ) : (
          <>
            <line x1={eP[0].x - (eP[1].x - eP[0].x) * 3} y1={eP[0].y - (eP[1].y - eP[0].y) * 3} x2={eP[0].x + (eP[1].x - eP[0].x) * 4} y2={eP[0].y + (eP[1].y - eP[0].y) * 4} className="gm-line" clipPath="url(#clipE)" />
            <line x1={eP[2].x - (eP[1].x - eP[0].x) * 3} y1={eP[2].y - (eP[1].y - eP[0].y) * 3} x2={eP[2].x + (eP[1].x - eP[0].x) * 4} y2={eP[2].y + (eP[1].y - eP[0].y) * 4} className="gm-par" clipPath="url(#clipE)" />
          </>
        )}
        <clipPath id="clipE">
          <rect x={centres[0].x - S - 10} y={centres[0].y - S - 10} width={2 * S + 20} height={2 * S + 20} />
        </clipPath>
        {eP.map((p, i) => handle(0, i, p, names[i]))}
        <text x={centres[0].x} y={2 * S + 78} className="gm-cap">
          Euclidean · {mode === 'triangle' ? `sum ${fmt(sumE)}°` : '1 parallel'}
        </text>

        {/* hyperbolic */}
        <circle cx={hc.x} cy={hc.y} r={S} className="gm-disk" />
        {mode === 'triangle' ? (
          <path d={hypTriPath(Hy, hc.x, hc.y)} className="gm-tri-edges" />
        ) : (
          <>
            <path d={hypLinePath(Hy[0], Hy[1], hc.x, hc.y)} className="gm-line" />
            {idealPoints(Hy[0], Hy[1]).map((I, k) => (
              <path key={k} d={hypLinePath(Hy[2], v(I.x * 0.999, I.y * 0.999), hc.x, hc.y)} className="gm-par" />
            ))}
            {(() => {
              // Lines through C that never meet AB have both ends on the arc of the boundary on C's side,
              // between I1 and J2 (J2: the far end of the limiting parallel through I2).
              const [I1, I2] = idealPoints(Hy[0], Hy[1]);
              const J = idealPoints(Hy[2], v(I2.x * 0.999, I2.y * 0.999));
              const J2 = Math.hypot(J[0].x - I2.x, J[0].y - I2.y) > Math.hypot(J[1].x - I2.x, J[1].y - I2.y) ? J[0] : J[1];
              const a1 = Math.atan2(I1.y, I1.x);
              const aJ = Math.atan2(J2.y, J2.x);
              const aI2 = Math.atan2(I2.y, I2.x);
              const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
              // counter-clockwise sweep from a1 to aJ, unless that passes I2
              let span = norm(aJ - a1);
              let dirn = 1;
              if (norm(aI2 - a1) < span) {
                span = 2 * Math.PI - span;
                dirn = -1;
              }
              return [0.2, 0.35, 0.5, 0.65, 0.8].map((t, k) => {
                const a = a1 + dirn * span * t;
                const T = v(Math.cos(a) * 0.999, Math.sin(a) * 0.999);
                return <path key={`u${k}`} d={hypLinePath(Hy[2], T, hc.x, hc.y)} className="gm-ultra" />;
              });
            })()}
          </>
        )}
        {Hy.map((p, i) => handle(1, i, v(hc.x + p.x * S, hc.y - p.y * S), names[i]))}
        <text x={hc.x} y={2 * S + 78} className="gm-cap">
          Hyperbolic (Poincaré disk) · {mode === 'triangle' ? `sum ${fmt(sumH)}°` : '∞ parallels'}
        </text>

        {/* spherical */}
        <circle cx={sc.x} cy={sc.y} r={S} className="gm-sphere" />
        {mode === 'triangle' ? (
          <>
            {(() => {
              const all = [0, 1, 2].flatMap((i) => arcPts(Sp[i], Sp[(i + 1) % 3]));
              const allFront = all.every((p) => view(p)[2] >= 0);
              return allFront ? <polygon points={all.map((p) => { const q = view(p); return `${(sc.x + q[0] * S).toFixed(1)},${(sc.y - q[1] * S).toFixed(1)}`; }).join(' ')} className="gm-fill" /> : null;
            })()}
            {[0, 1, 2].map((i) => {
              const { front, back } = sphPath(arcPts(Sp[i], Sp[(i + 1) % 3]), sc.x, sc.y);
              return (
                <g key={i}>
                  <path d={back} className="gm-back" />
                  <path d={front} className="gm-edge" />
                </g>
              );
            })}
          </>
        ) : (
          <>
            {(() => {
              const g1 = sphPath(greatCircle(Sp[0], Sp[1]), sc.x, sc.y);
              // the "parallel" through C: the great circle through C perpendicular to the plane through C and the pole of AB
              const pole = norm3(cross3(Sp[0], Sp[1]));
              const dir = norm3(cross3(pole, Sp[2]));
              const g2 = sphPath(greatCircle(Sp[2], dir), sc.x, sc.y);
              return (
                <>
                  <path d={g1.back} className="gm-back" />
                  <path d={g2.back} className="gm-back" />
                  <path d={g1.front} className="gm-line" fill="none" />
                  <path d={g2.front} className="gm-par" fill="none" />
                </>
              );
            })()}
          </>
        )}
        {Sp.map((p, i) => {
          const { P, front } = sphPt(p);
          return front ? handle(2, i, P, names[i]) : null;
        })}
        <text x={sc.x} y={2 * S + 78} className="gm-cap">
          Spherical · {mode === 'triangle' ? `sum ${fmt(sumS)}°` : 'no parallels: they meet'}
        </text>
      </svg>
      {mode === 'triangle' && (
        <table className="gm-table">
          <thead>
            <tr>
              <th />
              <th>∠A</th>
              <th>∠B</th>
              <th>∠C</th>
              <th>sum</th>
              <th>I.32 (sum = 180°)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Euclidean', eAng, sumE],
              ['Hyperbolic', hAng, sumH],
              ['Spherical', sAng, sumS],
            ].map(([n, a, s]) => (
              <tr key={n as string}>
                <td>{n as string}</td>
                {(a as number[]).map((x, i) => (
                  <td key={i}>{fmt(deg(x))}°</td>
                ))}
                <td>
                  <b>{fmt(s as number)}°</b>
                </td>
                <td>{Math.abs((s as number) - 180) < 0.05 ? '✓ holds' : (s as number) < 180 ? `fails: defect ${fmt(180 - (s as number))}°` : `fails: excess ${fmt((s as number) - 180)}°`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Widget>
  );
}
