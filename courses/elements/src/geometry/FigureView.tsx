// Draws a figure as SVG, lets the reader drag its given points, and links it with the text:
// hovering an object highlights its label in the text and vice versa; stepping through the proof
// reveals the construction paragraph by paragraph; Byrne mode colours what the text mentions.

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE, type ReactNode } from 'react';
import { circle3Points, evaluate, project as project3, type Camera, type Element, type FigureDef, type FigureState, type Scene } from './figure';
import { resolveAll, type Resolved } from './reveal';
import type { Mention, Shape, Target } from './resolve';
import { Degenerate, add, angle as angleAt, dist, mul, sub, unit, v, type V } from './vec';

export interface Bus {
  resolved: Resolved;
  scene: Scene;
  toScreen: (p: V) => V;
}

interface Props {
  def: FigureDef;
  mentions?: Mention[][];
  step?: number | null;
  byrne?: boolean;
  hoverKey?: string | null;
  onHover?: (key: string | null) => void;
  /** Called whenever the scene changes, so the text can colour and link its labels. */
  onBus?: (bus: Bus) => void;
  /** Labels are hidden in Byrne mode unless this is set. */
  labels?: boolean;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}

const W = 600;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function sceneBox(scene: Scene, proj: (p: V) => V): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const addP = (p: V) => {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  };
  for (const p of scene.points.values()) if (!p.hidden) addP(proj(p.p));
  for (const e of scene.elements) {
    if (e.kind === 'circle' && !e.aux) {
      const c = proj(e.c);
      addP(v(c.x - e.r, c.y - e.r));
      addP(v(c.x + e.r, c.y + e.r));
    } else if (e.kind === 'circle' || e.kind === 'arc') {
      const c = proj(e.c);
      addP(v(c.x - e.r, c.y - e.r));
      addP(v(c.x + e.r, c.y + e.r));
    } else if (e.kind === 'segment' || e.kind === 'ray') {
      addP(proj(e.a));
      addP(proj(e.b));
    } else if (e.kind === 'polygon' || e.kind === 'curve') e.pts.forEach((p) => addP(proj(p)));
    else if (e.kind === 'circle3') circle3Points(e.c, e.n, e.r, 24).forEach((p) => addP(proj(p)));
    else if (e.kind === 'sphere') {
      const c = proj(e.c);
      addP(v(c.x - e.r, c.y - e.r));
      addP(v(c.x + e.r, c.y + e.r));
    }
  }
  if (!Number.isFinite(x0)) return { x0: -1, y0: -1, x1: 1, y1: 1 };
  let w = x1 - x0 || 1;
  let h = y1 - y0 || 1;
  const pad = 0.1 * Math.max(w, h) + 1e-9;
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  y1 += pad;
  w = x1 - x0;
  h = y1 - y0;
  // keep the aspect ratio between 0.3 and 1.25
  if (h / w < 0.3) {
    const d = (0.3 * w - h) / 2;
    y0 -= d;
    y1 += d;
  } else if (h / w > 1.25) {
    const d = (h / 1.25 - w) / 2;
    x0 -= d;
    x1 += d;
  }
  return { x0, y0, x1, y1 };
}

function clipLine(a: V, b: V, box: Box, ray = false): [V, V] | null {
  const d = sub(b, a);
  let t0 = ray ? 0 : -Infinity;
  let t1 = Infinity;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    return true;
  };
  if (!clip(-d.x, a.x - box.x0) || !clip(d.x, box.x1 - a.x) || !clip(-d.y, a.y - box.y0) || !clip(d.y, box.y1 - a.y)) return null;
  if (t0 > t1) return null;
  return [add(a, mul(d, t0)), add(a, mul(d, t1))];
}

const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '0');

export function arcPath(c: V, r: number, a0: number, a1: number): string {
  // a0 → a1 counter-clockwise in figure coordinates; the caller has already mapped c and r to the screen (y flipped)
  const p0 = v(c.x + r * Math.cos(a0), c.y - r * Math.sin(a0));
  const p1 = v(c.x + r * Math.cos(a1), c.y - r * Math.sin(a1));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${fmt(p0.x)},${fmt(p0.y)} A${fmt(r)},${fmt(r)} 0 ${large} 0 ${fmt(p1.x)},${fmt(p1.y)}`;
}

/** The angle mark at B between BA and BC, on screen. */
function angleMark(A: V, B: V, C: V, rad: number, right: boolean, filled: boolean): string {
  const u = unit(sub(A, B));
  const w = unit(sub(C, B));
  if (right) {
    const s = rad * 0.7;
    const p1 = add(B, mul(u, s));
    const p2 = add(add(B, mul(u, s)), mul(w, s));
    const p3 = add(B, mul(w, s));
    return `M${fmt(p1.x)},${fmt(p1.y)} L${fmt(p2.x)},${fmt(p2.y)} L${fmt(p3.x)},${fmt(p3.y)}` + (filled ? ` L${fmt(B.x)},${fmt(B.y)} Z` : '');
  }
  const p1 = add(B, mul(u, rad));
  const p2 = add(B, mul(w, rad));
  // sweep the smaller angle; on screen y is down, so the orientation flips
  const crossZ = u.x * w.y - u.y * w.x;
  const sweep = crossZ > 0 ? 1 : 0;
  const arc = `A${fmt(rad)},${fmt(rad)} 0 0 ${sweep} ${fmt(p2.x)},${fmt(p2.y)}`;
  return filled ? `M${fmt(B.x)},${fmt(B.y)} L${fmt(p1.x)},${fmt(p1.y)} ${arc} Z` : `M${fmt(p1.x)},${fmt(p1.y)} ${arc}`;
}

export function useFigure(def: FigureDef) {
  const [state, setState] = useState<FigureState>({ free: {}, glide: {}, param: {} });
  const [camera, setCamera] = useState<Camera>(def.camera ?? { yaw: -0.6, pitch: 0.35 });
  const lastGood = useRef<Scene | null>(null);
  const scene = useMemo(() => {
    try {
      const s = evaluate(def, state);
      lastGood.current = s;
      return s;
    } catch (e) {
      if (e instanceof Degenerate && lastGood.current) return lastGood.current;
      throw e;
    }
  }, [def, state]);
  const trySet = useCallback(
    (next: FigureState) => {
      try {
        evaluate(def, next);
        setState(next);
      } catch (e) {
        if (!(e instanceof Degenerate)) throw e;
      }
    },
    [def],
  );
  const reset = useCallback(() => {
    setState({ free: {}, glide: {}, param: {} });
    setCamera(def.camera ?? { yaw: -0.6, pitch: 0.35 });
  }, [def]);
  return { state, setState: trySet, scene, camera, setCamera, reset };
}

export function FigureView({ def, mentions, step = null, byrne = false, hoverKey = null, onHover, onBus, labels, compact, className, children }: Props) {
  const { state, setState, scene, camera, setCamera, reset } = useFigure(def);
  const is3 = scene.dim === 3;
  const proj = useCallback((p: V): V => (is3 ? project3(p, camera) : p), [is3, camera]);
  // The view box is fixed when the figure is first drawn (and on reset), so that dragging does not rescale it.
  const [box, setBox] = useState<Box>(() => sceneBox(scene, proj));
  const boxKey = useRef(def);
  useEffect(() => {
    if (boxKey.current !== def) {
      boxKey.current = def;
      setBox(sceneBox(evaluate(def), proj));
    }
  }, [def, proj]);
  const k = W / (box.x1 - box.x0);
  const H = (box.y1 - box.y0) * k;
  const S = useCallback((p: V): V => {
    const q = proj(p);
    return v((q.x - box.x0) * k, (box.y1 - q.y) * k);
  }, [proj, box, k]);
  const fromScreen = (sx: number, sy: number): V => v(sx / k + box.x0, box.y1 - sy / k);

  const resolved = useMemo(() => resolveAll(scene, mentions ?? []), [scene, mentions]);
  useEffect(() => {
    onBus?.({ resolved, scene, toScreen: S });
  }, [resolved, scene, S, onBus]);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ name: string; kind: 'free' | 'glider' | 'rotate'; x: number; y: number; cam: Camera } | null>(null);

  const toLocal = (e: RPE) => {
    const r = svgRef.current!.getBoundingClientRect();
    return v(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };

  const onDown = (e: RPE, name: string, kind: 'free' | 'glider') => {
    e.stopPropagation();
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    drag.current = { name, kind, x: e.clientX, y: e.clientY, cam: camera };
  };
  const onBgDown = (e: RPE) => {
    if (!is3) return;
    (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId);
    drag.current = { name: '', kind: 'rotate', x: e.clientX, y: e.clientY, cam: camera };
  };
  const onMove = (e: RPE) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'rotate') {
      setCamera({ yaw: d.cam.yaw + (e.clientX - d.x) * 0.01, pitch: Math.max(-1.4, Math.min(1.4, d.cam.pitch + (e.clientY - d.y) * 0.01)) });
      return;
    }
    const l = toLocal(e);
    const p = fromScreen(l.x, l.y);
    if (d.kind === 'free') {
      const old = scene.points.get(d.name)!.p;
      setState({ ...state, free: { ...state.free, [d.name]: old.z === undefined ? p : { ...p, z: old.z } } });
    } else {
      const gl = scene.gliders.get(d.name);
      if (!gl) return;
      let t: number;
      if (gl.on.kind === 'circle') t = Math.atan2(p.y - gl.on.c.y, p.x - gl.on.c.x);
      else {
        const ab = sub(gl.on.b, gl.on.a);
        t = ((p.x - gl.on.a.x) * ab.x + (p.y - gl.on.a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y);
        if (gl.on.kind === 'segment') t = Math.max(0, Math.min(1, t));
      }
      setState({ ...state, glide: { ...state.glide, [d.name]: t } });
    }
  };
  const onUp = () => {
    drag.current = null;
  };

  const visibleEl = (i: number) => step === null || resolved.elementFrom[i] <= step;
  const visiblePt = (n: string) => step === null || (resolved.pointFrom.get(n) ?? 0) <= step;

  // colours: Byrne colours for mentioned objects (up to the current step)
  const mentionedKeys = new Set<string>();
  resolved.targets.forEach((row, i) => {
    if (step === null || i <= step) for (const t of row) if (t) mentionedKeys.add(t.key);
  });
  const stepKeys = new Set<string>();
  if (step !== null) for (const t of resolved.targets[step] ?? []) if (t) stepKeys.add(t.key);
  const colourOf = (key: string | undefined) => (byrne && key && mentionedKeys.has(key) ? resolved.colours.get(key) : undefined);

  // targets that are not figure elements are drawn as overlays in Byrne mode
  const overlayTargets: Target[] = [];
  if (byrne) {
    const seen = new Set<string>();
    resolved.targets.forEach((row, i) => {
      if (step !== null && i > step) return;
      for (const t of row) if (t && t.element === undefined && !seen.has(t.key) && t.shape.t !== 'point') {
        seen.add(t.key);
        overlayTargets.push(t);
      }
    });
  }
  const hoverTarget = hoverKey ? resolved.targets.flat().find((t) => t?.key === hoverKey) ?? null : null;

  const angleRadius = (A: V, B: V, C: V) => Math.max(9, Math.min(26, 0.32 * Math.min(dist(A, B), dist(C, B))));
  // several marks at one vertex are drawn at increasing radii, so they do not pile up
  const angleRank = new Map<number, number>();
  {
    const byVertex = new Map<string, number[]>();
    scene.elements.forEach((e, i) => {
      if (e.kind !== 'angle' || e.right) return;
      const b = S(e.b);
      const key = `${Math.round(b.x)},${Math.round(b.y)}`;
      (byVertex.get(key) ?? byVertex.set(key, []).get(key)!).push(i);
    });
    for (const list of byVertex.values()) {
      // smaller angles get the smaller radius
      const sized = list.map((i) => {
        const e = scene.elements[i] as Extract<Element, { kind: 'angle' }>;
        let a = 0;
        try {
          a = angleAt(S(e.a), S(e.b), S(e.c));
        } catch {
          a = 0;
        }
        return { i, a };
      });
      sized.sort((x, y) => x.a - y.a).forEach(({ i }, rank) => angleRank.set(i, rank));
    }
  }

  const shapeSvg = (s: Shape, cls: string, style: React.CSSProperties = {}, key?: string): ReactNode => {
    switch (s.t) {
      case 'point': {
        const p = S(s.p);
        return <circle key={key} className={cls} cx={p.x} cy={p.y} r={7} style={style} />;
      }
      case 'seg': {
        const a = S(s.a);
        const b = S(s.b);
        return <line key={key} className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={style} />;
      }
      case 'path':
        return <polyline key={key} className={cls} points={s.pts.map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} style={{ ...style, fill: 'none' }} />;
      case 'poly':
        return <polygon key={key} className={cls} points={s.pts.map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} style={style} />;
      case 'angle': {
        const A = S(s.a);
        const B = S(s.b);
        const C = S(s.c);
        return <path key={key} className={cls} d={angleMark(A, B, C, angleRadius(A, B, C), false, cls.includes('fill'))} style={style} />;
      }
      case 'circle': {
        const c = S(s.c);
        return <circle key={key} className={cls} cx={c.x} cy={c.y} r={s.r * k} style={{ ...style, fill: 'none' }} />;
      }
      case 'arc': {
        const c = S(s.c);
        return <path key={key} className={cls} d={arcPath(c, s.r * k, s.a0, s.a1)} style={{ ...style, fill: 'none' }} />;
      }
      case 'element':
        return elementSvg(scene.elements[s.index], s.index, cls, style, key);
    }
  };

  const elementSvg = (e: Element, i: number, cls: string, style: React.CSSProperties = {}, key?: string | number): ReactNode => {
    const common = { className: `${cls} el-${e.kind}${e.aux ? ' aux' : ''}${e.dashed ? ' dashed' : ''}`, style };
    switch (e.kind) {
      case 'segment': {
        const a = S(e.a);
        const b = S(e.b);
        const ticks: ReactNode[] = [];
        if (e.ticks && e.ticks > 0) {
          const n = Math.round(dist(e.a, e.b) / e.ticks);
          const dd = sub(b, a);
          const nn = unit(v(-dd.y, dd.x));
          if (n > 0 && n <= 200) for (let j = 0; j <= n; j++) {
            const p = add(a, mul(dd, j / n));
            ticks.push(<line key={j} className="tick" x1={p.x - nn.x * 4} y1={p.y - nn.y * 4} x2={p.x + nn.x * 4} y2={p.y + nn.y * 4} />);
          }
        }
        return (
          <g key={key}>
            <line {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {ticks}
          </g>
        );
      }
      case 'line':
      case 'ray': {
        const c = clipLine(proj(e.a), proj(e.b), box, e.kind === 'ray');
        if (!c) return null;
        const a = v((c[0].x - box.x0) * k, (box.y1 - c[0].y) * k);
        const b = v((c[1].x - box.x0) * k, (box.y1 - c[1].y) * k);
        return <line key={key} {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      }
      case 'circle': {
        const c = S(e.c);
        return <circle key={key} {...common} cx={c.x} cy={c.y} r={e.r * k} style={{ ...style, fill: 'none' }} />;
      }
      case 'arc': {
        const c = S(e.c);
        return <path key={key} {...common} d={arcPath(c, e.r * k, e.a0, e.a1)} style={{ ...style, fill: 'none' }} />;
      }
      case 'polygon':
        return <polygon key={key} {...common} className={`${common.className}${e.fill ? ' filled' : ''}`} points={e.pts.map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} />;
      case 'angle': {
        const A = S(e.a);
        const B = S(e.b);
        const C = S(e.c);
        const rad = e.r ?? angleRadius(A, B, C) + 7 * (angleRank.get(i) ?? 0);
        return <path key={key} {...common} d={angleMark(A, B, C, rad, !!e.right, false)} style={{ ...style, fill: 'none' }} />;
      }
      case 'curve':
        return e.closed ? (
          <polygon key={key} {...common} points={e.pts.map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} />
        ) : (
          <polyline key={key} {...common} points={e.pts.map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} style={{ ...style, fill: 'none' }} />
        );
      case 'circle3':
        return <polygon key={key} {...common} points={circle3Points(e.c, e.n, e.r).map(S).map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')} style={{ ...style, fill: 'none' }} />;
      case 'sphere': {
        const c = S(e.c);
        return <circle key={key} {...common} cx={c.x} cy={c.y} r={e.r * k} style={{ ...style, fill: 'none' }} />;
      }
      case 'text': {
        const p = S(e.at);
        return (
          <text key={key} {...common} x={p.x} y={p.y} className={`${common.className} fig-text`}>
            {e.text}
          </text>
        );
      }
    }
    void i;
  };

  // label placement: away from the neighbours of each point
  const neighbours = new Map<string, V[]>();
  const link = (a: V & { n?: string }, b: V) => {
    const n = (a as { n?: string }).n;
    if (n) (neighbours.get(n) ?? neighbours.set(n, []).get(n)!).push(S(b));
  };
  scene.elements.forEach((e, i) => {
    if (!visibleEl(i)) return;
    if (e.kind === 'segment' || e.kind === 'line' || e.kind === 'ray') {
      link(e.a, e.b);
      link(e.b, e.a);
    } else if (e.kind === 'polygon') {
      e.pts.forEach((p, j) => {
        link(p, e.pts[(j + 1) % e.pts.length]);
        link(p, e.pts[(j + e.pts.length - 1) % e.pts.length]);
      });
    } else if (e.kind === 'circle' || e.kind === 'arc') {
      for (const n of e.names) {
        const p = scene.points.get(n);
        if (p) (neighbours.get(n) ?? neighbours.set(n, []).get(n)!).push(S(e.c));
      }
    }
  });
  const pts = [...scene.points.values()].filter((p) => !p.hidden && visiblePt(p.name));
  const centroid = pts.length ? mul(pts.map((p) => S(p.p)).reduce(add, v(0, 0)), 1 / pts.length) : v(W / 2, H / 2);
  const labelPos = (name: string, p: V, dir?: number): V => {
    if (dir !== undefined) return add(p, v(15 * Math.cos((dir * Math.PI) / 180), -15 * Math.sin((dir * Math.PI) / 180)));
    const ns = neighbours.get(name) ?? [];
    let d = v(0, 0);
    for (const q of ns) {
      const u = sub(q, p);
      const l = Math.hypot(u.x, u.y);
      if (l > 1e-6) d = add(d, mul(u, 1 / l));
    }
    let away: V;
    if (Math.hypot(d.x, d.y) > 0.3) away = mul(d, -1 / Math.hypot(d.x, d.y));
    else if (ns.length >= 2) {
      const u = sub(ns[0], p);
      const perpDir = v(-u.y, u.x);
      const l = Math.hypot(perpDir.x, perpDir.y) || 1;
      away = mul(perpDir, 1 / l);
      // prefer the side away from the centroid
      if ((centroid.x - p.x) * away.x + (centroid.y - p.y) * away.y > 0) away = mul(away, -1);
    } else {
      const u = sub(p, centroid);
      const l = Math.hypot(u.x, u.y);
      away = l > 1e-6 ? mul(u, 1 / l) : v(0, -1);
    }
    return add(p, mul(away, 14));
  };

  // painter's order for solids: far polygons first
  const order = scene.elements.map((_, i) => i);
  if (is3) {
    const depthOf = (e: Element) => {
      const ps = e.kind === 'polygon' || e.kind === 'curve' ? e.pts : e.kind === 'segment' ? [e.a, e.b] : e.kind === 'circle3' || e.kind === 'sphere' ? [e.c] : [];
      if (!ps.length) return 0;
      return ps.reduce((s, p) => s + (project3(p, camera).z ?? 0), 0) / ps.length;
    };
    order.sort((a, b) => depthOf(scene.elements[b]) - depthOf(scene.elements[a]) || a - b);
  }

  const showLabels = labels ?? !byrne;

  return (
    <div className={`figure ${compact ? 'compact' : ''} ${byrne ? 'byrne' : ''} ${className ?? ''}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${fmt(H)}`}
        className={`figure-svg ${is3 ? 'solid' : ''}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerDown={onBgDown}
        role="img"
        aria-label="Figure; drag the highlighted points"
      >
        {order.map((i) => {
          const e = scene.elements[i];
          if (!visibleEl(i)) return null;
          const key = resolved.elementKey.get(i);
          const c = colourOf(key);
          const current = key !== undefined && stepKeys.has(key);
          const style: React.CSSProperties = c ? ({ '--c': c.colour, strokeDasharray: c.dash } as React.CSSProperties) : {};
          return (
            <g
              key={i}
              className={`el ${c ? 'coloured' : ''} ${current ? 'current' : ''} ${key && key === hoverKey ? 'hovered' : ''}`}
              onPointerEnter={() => key && onHover?.(key)}
              onPointerLeave={() => key && onHover?.(null)}
            >
              {elementSvg(e, i, 'shape', style)}
            </g>
          );
        })}
        {scene.elements.map((e, i) => {
          if (!e.text || e.kind === 'text' || !visibleEl(i)) return null;
          let at: V | null = null;
          let off = v(0, 0);
          if (e.kind === 'segment' || e.kind === 'line' || e.kind === 'ray') {
            const a = S(e.a);
            const b = S(e.b);
            at = v((a.x + b.x) / 2, (a.y + b.y) / 2);
            const d = sub(b, a);
            const l = Math.hypot(d.x, d.y) || 1;
            off = v((d.y / l) * 13, (-d.x / l) * 13);
            if (off.y > 0) off = v(-off.x, -off.y);
          } else if (e.kind === 'polygon' || e.kind === 'curve') {
            const ps = e.pts.map(S);
            at = v(ps.reduce((s2, p) => s2 + p.x, 0) / ps.length, ps.reduce((s2, p) => s2 + p.y, 0) / ps.length);
          } else if (e.kind === 'circle' || e.kind === 'sphere') {
            const c = S(e.c);
            at = v(c.x + e.r * k * 0.72, c.y - e.r * k * 0.72);
            off = v(8, -8);
          } else if (e.kind === 'angle') {
            const B = S(e.b);
            const m = add(unit(sub(S(e.a), B)), unit(sub(S(e.c), B)));
            at = add(B, mul(m, 24 / (Math.hypot(m.x, m.y) || 1)));
          }
          if (!at) return null;
          return (
            <text key={`t${i}`} x={at.x + off.x} y={at.y + off.y} dy="0.35em" textAnchor="middle" className="el-label" pointerEvents="none">
              {e.text}
            </text>
          );
        })}
        {overlayTargets.map((t) => {
          const c = resolved.colours.get(t.key);
          if (!c) return null;
          const style = { '--c': c.colour, strokeDasharray: c.dash } as React.CSSProperties;
          return (
            <g key={t.key} className={`overlay coloured ${t.key === hoverKey ? 'hovered' : ''}`} onPointerEnter={() => onHover?.(t.key)} onPointerLeave={() => onHover?.(null)}>
              {shapeSvg(t.shape, t.shape.t === 'angle' ? 'shape fill' : 'shape', style)}
            </g>
          );
        })}
        {step !== null &&
          (resolved.targets[step] ?? []).map((t, j) =>
            t && t.shape.t !== 'element' ? <g key={`s${j}`} className="step-hl">{shapeSvg(t.shape, t.shape.t === 'angle' ? 'shape fill' : 'shape')}</g> : null,
          )}
        {hoverTarget && <g className="hover-hl">{shapeSvg(hoverTarget.shape, hoverTarget.shape.t === 'angle' ? 'shape fill' : 'shape')}</g>}
        {pts.map((p) => {
          const s = S(p.p);
          const draggable = p.kind === 'free' || p.kind === 'glider';
          const key = `pt:${p.name}`;
          return (
            <g key={p.name} className={`pt ${p.kind} ${key === hoverKey ? 'hovered' : ''}`} onPointerEnter={() => onHover?.(key)} onPointerLeave={() => onHover?.(null)}>
              {draggable && !is3 && <circle className="handle" cx={s.x} cy={s.y} r={14} onPointerDown={(e) => onDown(e, p.name, p.kind as 'free' | 'glider')} />}
              <circle className="dot" cx={s.x} cy={s.y} r={draggable && !is3 ? 4.2 : 2.8} pointerEvents="none" />
              {showLabels && (() => {
                const lp = labelPos(p.name, s, p.labelDir);
                return (
                  <text className="lbl" x={lp.x} y={lp.y} dy="0.35em" textAnchor="middle" pointerEvents="none">
                    {p.name}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>
      {!compact && (
        <div className="figure-tools">
          {scene.params.map((prm) => (
            <label key={prm.name} className="param">
              <span>{prm.label}</span>
              <input type="range" min={prm.min} max={prm.max} step={prm.step} value={prm.value} onChange={(e) => setState({ ...state, param: { ...state.param, [prm.name]: Number(e.target.value) } })} />
              <output>{Number.isInteger(prm.step) ? prm.value : prm.value.toFixed(2)}</output>
            </label>
          ))}
          {(scene.claims.length > 0 || scene.readouts.length > 0) && (
            <ul className="readouts" aria-live="polite">
              {scene.readouts.map((r) => (
                <li key={r.label}>
                  <span className="rl">{r.label}</span> <span className="rv">{typeof r.value === 'number' ? fmtNum(r.value) : r.value}</span>
                </li>
              ))}
              {scene.claims.map((c) => (
                <li key={c.label} className={c.ok ? 'ok' : 'bad'} title="Checked numerically in the current configuration">
                  <span className="rl">{c.label}</span>
                  {c.lhs !== undefined && (
                    <span className="rv">
                      {fmtNum(c.lhs)} {c.ok ? '=' : '≠'} {fmtNum(c.rhs!)}
                    </span>
                  )}
                  <span className="mark">{c.ok ? '✓' : '✗'}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="figure-buttons">
            {children}
            <button className="chip-btn" onClick={() => { reset(); setBox(sceneBox(evaluate(def), proj)); }} title="Reset the figure">
              ↺ Reset
            </button>
          </div>
          {def.caption && <p className="figure-caption">{def.caption}</p>}
          {(scene.gliders.size > 0 || [...scene.points.values()].some((p) => p.kind === 'free') || is3) && (
            <p className="figure-hint">{is3 ? 'Drag to turn the figure.' : 'Drag the larger points.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x) && Math.abs(x) < 1e9) return String(x);
  const a = Math.abs(x);
  return a >= 1000 ? x.toFixed(0) : a >= 10 ? x.toFixed(2) : x.toFixed(3);
}

export { angleAt };
