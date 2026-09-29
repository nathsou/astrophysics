// Why there are exactly five regular solids (XIII.18, after XI.21): at a vertex, at least three
// equal regular polygons meet, and their angles must add up to less than four right angles, or
// they lie flat. Then the five solids themselves, to turn.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Widget } from '../shared/Widget';

type V3 = [number, number, number];
const PHI = (1 + Math.sqrt(5)) / 2;

const SOLIDS: Record<string, { name: string; vertices: V3[]; faces: string; book: string }> = {
  tetrahedron: { name: 'Pyramid (tetrahedron)', faces: '4 triangles, 3 at each vertex', book: 'XIII.13', vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] },
  octahedron: { name: 'Octahedron', faces: '8 triangles, 4 at each vertex', book: 'XIII.14', vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
  cube: { name: 'Cube', faces: '6 squares, 3 at each vertex', book: 'XIII.15', vertices: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as V3))) },
  icosahedron: {
    name: 'Icosahedron',
    faces: '20 triangles, 5 at each vertex',
    book: 'XIII.16',
    vertices: [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]] as V3[])),
  },
  dodecahedron: {
    name: 'Dodecahedron',
    faces: '12 pentagons, 3 at each vertex',
    book: 'XIII.17',
    vertices: [
      ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as V3))),
      ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]] as V3[])),
    ],
  },
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Faces of the convex hull of a (small) symmetric point set, each as vertex indices in order. */
function hullFaces(vs: V3[]): number[][] {
  const faces: number[][] = [];
  const seen = new Set<string>();
  const n = vs.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        let nrm = cross(sub(vs[j], vs[i]), sub(vs[k], vs[i]));
        const l = Math.hypot(...nrm);
        if (l < 1e-9) continue;
        nrm = [nrm[0] / l, nrm[1] / l, nrm[2] / l];
        const d = dot(nrm, vs[i]);
        let pos = 0;
        let neg = 0;
        const on: number[] = [];
        vs.forEach((p, m) => {
          const s = dot(nrm, p) - d;
          if (Math.abs(s) < 1e-6) on.push(m);
          else if (s > 0) pos++;
          else neg++;
        });
        if (pos && neg) continue;
        const key = on.slice().sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        // outward normal
        const out: V3 = pos ? [-nrm[0], -nrm[1], -nrm[2]] : nrm;
        const c: V3 = [0, 1, 2].map((t) => on.reduce((s, m) => s + vs[m][t], 0) / on.length) as V3;
        const u0 = sub(vs[on[0]], c);
        const w0 = cross(out, u0);
        on.sort((a, b) => Math.atan2(dot(sub(vs[a], c), w0), dot(sub(vs[a], c), u0)) - Math.atan2(dot(sub(vs[b], c), w0), dot(sub(vs[b], c), u0)));
        faces.push(on);
      }
  return faces;
}

function rot(p: V3, yaw: number, pitch: number): V3 {
  const x1 = p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw);
  const z1 = p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
  const y2 = p[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = p[1] * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}

function VertexFan() {
  const [sides, setSides] = useState(3);
  const [count, setCount] = useState(3);
  const interior = 180 - 360 / sides;
  const total = interior * count;
  const names: Record<string, string> = { '3,3': 'tetrahedron', '3,4': 'octahedron', '3,5': 'icosahedron', '4,3': 'cube', '5,3': 'dodecahedron' };
  const solid = names[`${sides},${count}`];
  const R = 110;
  const cx = 150;
  const cy = 150;
  const polys: [number, number][][] = [];
  for (let f = 0; f < count; f++) {
    // the fan is centred on the upward direction, so the gap (if any) is at the bottom
    const start = ((90 - Math.min(total, 360) / 2 + f * interior) * Math.PI) / 180;
    // a regular polygon with one vertex at the centre, two edges along start and start + interior
    const side = R * (sides === 3 ? 0.95 : sides === 4 ? 0.75 : 0.62);
    const pts: [number, number][] = [[0, 0]];
    let ang = start;
    let p: [number, number] = [side * Math.cos(ang), side * Math.sin(ang)];
    pts.push(p);
    for (let k = 1; k < sides - 1; k++) {
      ang += Math.PI - ((sides - 2) * Math.PI) / sides;
      p = [p[0] + side * Math.cos(ang), p[1] + side * Math.sin(ang)];
      pts.push(p);
    }
    polys.push(pts.map(([x, y]) => [cx + x, cy - y]));
  }
  const colours = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--byrne-black)'];
  const verdict =
    total < 360 - 1e-9 ? `${total.toFixed(0)}° < 360°: the gap closes up into a solid angle. This is the ${solid}.` : Math.abs(total - 360) < 1e-9 ? '= 360°: the faces lie flat. A tiling of the plane, not a solid.' : `${total.toFixed(0)}° > 360°: the faces overlap. Impossible (XI.21).`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)', gap: 16, alignItems: 'center' }}>
      <svg viewBox="0 0 300 300" role="img" aria-label={`${count} regular ${sides}-gons around a vertex`}>
        {polys.map((pts, i) => (
          <polygon key={i} points={pts.map((p) => p.join(',')).join(' ')} fill={colours[i % 4]} fillOpacity={0.55} stroke="var(--fig-ink)" strokeWidth={1.2} />
        ))}
        <circle cx={cx} cy={cy} r={3} fill="var(--fig-ink)" />
      </svg>
      <div>
        <div className="row">
          <label>
            faces:{' '}
            <select value={sides} onChange={(e) => setSides(Number(e.target.value))}>
              {[3, 4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  {({ 3: 'triangles', 4: 'squares', 5: 'pentagons', 6: 'hexagons' } as Record<number, string>)[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            at each vertex: <input type="range" min={3} max={6} value={count} onChange={(e) => setCount(Number(e.target.value))} /> {count}
          </label>
        </div>
        <p>
          Each angle is {interior.toFixed(0)}°, so {count} of them make {total.toFixed(0)}°.
        </p>
        <p>
          <b>{verdict}</b>
        </p>
        <p className="note">At least three faces must meet at a vertex, and their angles must total less than four right angles (XI.21). That leaves exactly five possibilities, which XIII.18 records after constructing them.</p>
      </div>
    </div>
  );
}

function Turntable() {
  const [which, setWhich] = useState('icosahedron');
  const [angles, setAngles] = useState({ yaw: 0.5, pitch: 0.4 });
  const [spin, setSpin] = useState(true);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const s = SOLIDS[which];
  const faces = useMemo(() => hullFaces(s.vertices), [s]);
  useEffect(() => {
    if (!spin) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      setAngles((a) => ({ ...a, yaw: a.yaw + (t - last) * 0.0004 }));
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spin]);
  const scale = 95 / Math.max(...s.vertices.map((p) => Math.hypot(...p)));
  const P = s.vertices.map((p) => rot(p, angles.yaw, angles.pitch));
  const drawn = faces
    .map((f) => {
      const n = cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]]));
      const c = f.reduce((acc, i) => acc + P[i][2], 0) / f.length;
      return { f, facing: n[2], depth: c };
    })
    .sort((a, b) => a.depth - b.depth);
  const light = (f: number[]) => {
    const n = cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]]));
    const l = Math.hypot(...n);
    return Math.abs(n[2] / l);
  };
  return (
    <div>
      <div className="row">
        {Object.entries(SOLIDS).map(([k, v]) => (
          <button key={k} className={`chip-btn ${k === which ? 'on' : ''}`} onClick={() => setWhich(k)}>
            {v.name.split(' ')[0]}
          </button>
        ))}
        <button className="chip-btn" onClick={() => setSpin(!spin)}>{spin ? 'Pause' : 'Spin'}</button>
      </div>
      <svg
        viewBox="-120 -120 240 240"
        style={{ maxWidth: 360, touchAction: 'none', cursor: 'grab' }}
        onPointerDown={(e) => ((drag.current = { x: e.clientX, y: e.clientY, ...angles }), setSpin(false), (e.target as SVGElement).setPointerCapture?.(e.pointerId))}
        onPointerMove={(e) => drag.current && setAngles({ yaw: drag.current.yaw + (e.clientX - drag.current.x) * 0.01, pitch: drag.current.pitch + (e.clientY - drag.current.y) * 0.01 })}
        onPointerUp={() => (drag.current = null)}
        role="img"
        aria-label={s.name}
      >
        {drawn.map(({ f, facing }, i) => (
          <polygon
            key={i}
            points={f.map((j) => `${(P[j][0] * scale).toFixed(1)},${(-P[j][1] * scale).toFixed(1)}`).join(' ')}
            fill={facing < 0 ? 'var(--byrne-yellow)' : 'var(--byrne-red)'}
            fillOpacity={facing < 0 ? 0.08 : 0.25 + 0.6 * light(f)}
            stroke="var(--fig-ink)"
            strokeWidth={facing < 0 ? 0.5 : 1.2}
            strokeDasharray={facing < 0 ? '2 3' : undefined}
          />
        ))}
      </svg>
      <p>
        <b>{s.name}</b>: {s.faces}. Constructed in a sphere in <a href={`#/13.${s.book.split('.')[1]}`}>{s.book}</a>.
      </p>
    </div>
  );
}

export default function RegularSolids() {
  return (
    <Widget title="Why only five?">
      <VertexFan />
      <hr style={{ border: 0, borderTop: '1px solid var(--rule)', margin: '14px 0' }} />
      <Turntable />
    </Widget>
  );
}
