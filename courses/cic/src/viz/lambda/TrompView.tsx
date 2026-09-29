// John Tromp's lambda diagrams, drawn on a canvas.
//
// Each λ is a horizontal bar; each variable is a vertical wire hanging from
// the bar of its binder; an application joins the wire of the function with
// the wire of its argument by a horizontal link, and the function's wire
// continues downwards.

import { createEffect, onCleanup, onMount } from 'solid-js';
import type { Path, Redex, U } from '../../kernel/untyped/lambda.ts';
import { isDark, palette } from '../../app/theme.ts';

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'lam' | 'var' | 'app';
  hot: boolean;
  depth: number;
}

const isPrefix = (p: Path, q: Path) => p.length <= q.length && p.every((x, i) => x === q[i]);

export function trompLayout(t: U, redexPath?: Path): { segs: Seg[]; w: number; h: number } {
  const segs: Seg[] = [];
  const hot = (p: Path) => !!redexPath && isPrefix(redexPath, p);
  // returns width, height (rows used below `row`), the wire column and where it starts
  const go = (t: U, env: Map<string, number>, row: number, x0: number, path: Path, depth: number): { w: number; h: number; wx: number; wtop: number } => {
    switch (t.k) {
      case 'var':
      case 'def': {
        const top = t.k === 'var' && env.has(t.name) ? env.get(t.name)! : row - 0.5;
        return { w: 1, h: 0, wx: x0, wtop: top };
      }
      case 'lam': {
        const e = new Map(env);
        e.set(t.name, row);
        const b = go(t.body, e, row + 1, x0, [...path, 0], depth + 1);
        segs.push({ x1: x0 - 0.35, y1: row, x2: x0 + b.w - 1 + 0.35, y2: row, kind: 'lam', hot: hot(path), depth });
        return { w: b.w, h: b.h + 1, wx: b.wx, wtop: b.wtop };
      }
      case 'app': {
        const f = go(t.fn, env, row, x0, [...path, 0], depth);
        const a = go(t.arg, env, row, x0 + f.w, [...path, 1], depth);
        const join = row + Math.max(f.h, a.h);
        const h = hot(path);
        segs.push({ x1: f.wx, y1: f.wtop, x2: f.wx, y2: join, kind: 'var', hot: h, depth });
        segs.push({ x1: a.wx, y1: a.wtop, x2: a.wx, y2: join, kind: 'var', hot: h, depth });
        segs.push({ x1: f.wx, y1: join, x2: a.wx, y2: join, kind: 'app', hot: h, depth });
        return { w: f.w + a.w, h: Math.max(f.h, a.h) + 1, wx: f.wx, wtop: join };
      }
    }
  };
  const r = go(t, new Map(), 0, 0, [], 0);
  segs.push({ x1: r.wx, y1: r.wtop, x2: r.wx, y2: r.h + 0.6, kind: 'var', hot: false, depth: 0 });
  return { segs, w: r.w, h: r.h + 1 };
}

export function TrompView(props: { term: U; next?: Redex; height?: number }) {
  let canvas!: HTMLCanvasElement;
  let wrap!: HTMLDivElement;
  const draw = () => {
    const L = trompLayout(props.term, props.next?.path);
    const maxH = props.height ?? 360;
    const availW = wrap.clientWidth - 24;
    const unit = Math.max(3, Math.min(22, availW / (L.w + 1), maxH / (L.h + 0.5)));
    const W = Math.max(availW, (L.w + 1) * unit);
    const H = (L.h + 0.8) * unit;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ox = (W - (L.w - 1) * unit) / 2;
    const oy = unit * 0.5;
    const dark = isDark();
    void palette(); // redraw when the palette changes
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || (dark ? '#eee' : '#222');
    const hotC = css.getPropertyValue('--hl-redex-border').trim() || '#e0a800';
    const lw = Math.max(1.5, unit * 0.28);
    ctx.lineCap = 'round';
    for (const s of L.segs) {
      ctx.strokeStyle = s.hot ? hotC : s.kind === 'lam' ? `hsl(${(s.depth * 47 + 230) % 360} 60% ${dark ? 68 : 45}%)` : ink;
      ctx.lineWidth = s.kind === 'lam' ? lw * 1.25 : lw;
      ctx.globalAlpha = s.kind === 'var' ? 0.9 : 1;
      ctx.beginPath();
      ctx.moveTo(ox + s.x1 * unit, oy + s.y1 * unit);
      ctx.lineTo(ox + s.x2 * unit, oy + s.y2 * unit);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  onMount(() => {
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    onCleanup(() => ro.disconnect());
  });
  createEffect(() => {
    void props.term;
    void props.next;
    draw();
  });
  return (
    <div class="tromp" ref={wrap}>
      <canvas ref={canvas} />
    </div>
  );
}
