// Renders Heath's text. Every label is linked to the figure: hovering it highlights the object,
// and in Byrne mode it is replaced by a small drawing of the object in its colour.

import type { ReactNode } from 'react';
import type { Inline, Para } from '../text/types';
import type { Bus } from '../geometry/FigureView';
import type { Shape, Target } from '../geometry/resolve';
import { Cite } from './Cite';
import { arcPath } from '../geometry/FigureView';
import { add, sub, v, type V } from '../geometry/vec';

interface Props {
  paras: Para[];
  bus?: Bus | null;
  byrne?: boolean;
  hoverKey?: string | null;
  onHover?: (k: string | null) => void;
  step?: number | null;
  onStep?: (i: number) => void;
  /** Hide the enunciation (it is shown in the header). */
  skipEnunciation?: boolean;
}

export function HeathText({ paras, bus, byrne, hoverKey, onHover, step, onStep, skipEnunciation }: Props) {
  return (
    <div className="heath">
      {paras.map((p, i) => {
        if (skipEnunciation && p.role === 'enunciation') return null;
        let j = 0;
        const next = () => bus?.resolved.targets[i]?.[j++] ?? null;
        return (
          <p
            key={p.id}
            className={`hp role-${p.role} ${step === i ? 'stepping' : ''}`}
            onClick={onStep && p.role !== 'enunciation' ? (e) => !(e.target as HTMLElement).closest('a') && onStep(i) : undefined}
          >
            {p.role === 'porism' && null}
            {renderInlines(p.c, { next, bus, byrne, hoverKey, onHover })}
          </p>
        );
      })}
    </div>
  );
}

interface Ctx {
  next: () => Target | null;
  /** Render citations as plain text (inside a link). */
  noLinks?: boolean;
  bus?: Bus | null;
  byrne?: boolean;
  hoverKey?: string | null;
  onHover?: (k: string | null) => void;
}

export function renderInlines(c: Inline[], ctx: Ctx): ReactNode[] {
  return c.map((x, i) => {
    if (typeof x === 'string') return x;
    switch (x.t) {
      case 'label': {
        const t = ctx.next();
        return <Label key={i} v={x.v} target={t} ctx={ctx} />;
      }
      case 'ref':
        return ctx.noLinks ? <span key={i} className="cite-plain">{x.text}</span> : <Cite key={i} id={x.to.split(' ')[0]} text={x.text} />;
      case 'em':
        return <em key={i}>{renderInlines(x.c, ctx)}</em>;
      case 'strong':
        return <strong key={i}>{renderInlines(x.c, ctx)}</strong>;
      case 'foreign':
        return (
          <i key={i} lang={x.lang === 'grc' ? 'grc' : x.lang === 'lat' ? 'la' : undefined} className={`foreign ${x.lang}`}>
            {renderInlines(x.c, ctx)}
          </i>
        );
      case 'quote':
        return <q key={i}>{renderInlines(x.c, ctx)}</q>;
      case 'centre':
        return (
          <span key={i} className="centred">
            {renderInlines(x.c, ctx)}
          </span>
        );
    }
  });
}

function Label({ v: text, target, ctx }: { v: string; target: Target | null; ctx: Ctx }) {
  const key = target?.key;
  const colour = key ? ctx.bus?.resolved.colours.get(key) : undefined;
  const cls = `lab ${target ? 'linked' : ''} ${key && key === ctx.hoverKey ? 'hovered' : ''}`;
  const glyph = ctx.byrne && target && colour && ctx.bus ? <Glyph shape={target.shape} bus={ctx.bus} colour={colour.colour} dash={colour.dash} /> : null;
  return (
    <span className={cls} onPointerEnter={() => key && ctx.onHover?.(key)} onPointerLeave={() => key && ctx.onHover?.(null)} title={glyph ? text : undefined}>
      {glyph ?? text}
    </span>
  );
}

/** A small drawing of an object, scaled to the line height, in its Byrne colour. */
export function Glyph({ shape, bus, colour, dash }: { shape: Shape; bus: Bus; colour: string; dash?: string }) {
  const S = bus.toScreen;
  const el = shape.t === 'element' ? bus.scene.elements[shape.index] : null;
  let pts: V[] = [];
  let kind: 'line' | 'poly' | 'angle' | 'circle' | 'arc' | 'path' = 'line';
  let circle: { c: V; r: number; a0?: number; a1?: number } | null = null;
  const ss = (p: V) => S(p);
  if (shape.t === 'seg') pts = [ss(shape.a), ss(shape.b)];
  else if (shape.t === 'path') ((pts = shape.pts.map(ss)), (kind = 'path'));
  else if (shape.t === 'poly') ((pts = shape.pts.map(ss)), (kind = 'poly'));
  else if (shape.t === 'angle') ((pts = [ss(shape.a), ss(shape.b), ss(shape.c)]), (kind = 'angle'));
  else if (shape.t === 'circle') ((kind = 'circle'), (circle = { c: ss(shape.c), r: 1 }));
  else if (shape.t === 'arc') ((kind = 'arc'), (circle = { c: ss(shape.c), r: 1, a0: shape.a0, a1: shape.a1 }));
  else if (el) {
    if (el.kind === 'segment' || el.kind === 'line' || el.kind === 'ray') pts = [ss(el.a), ss(el.b)];
    else if (el.kind === 'polygon') ((pts = el.pts.map(ss)), (kind = 'poly'));
    else if (el.kind === 'angle') ((pts = [ss(el.a), ss(el.b), ss(el.c)]), (kind = 'angle'));
    else if (el.kind === 'circle') ((kind = 'circle'), (circle = { c: ss(el.c), r: 1 }));
    else if (el.kind === 'arc') ((kind = 'arc'), (circle = { c: ss(el.c), r: 1, a0: el.a0, a1: el.a1 }));
  } else if (shape.t === 'point') return null;

  const H = 18;
  if (kind === 'circle' || kind === 'arc') {
    const r = H / 2 - 1.5;
    const c = v(H / 2, H / 2);
    return (
      <svg className="glyph" width={H} height={H} viewBox={`0 0 ${H} ${H}`} aria-hidden="true">
        {kind === 'circle' ? (
          <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={colour} strokeWidth={2} strokeDasharray={dash} />
        ) : (
          <path d={arcPath(c, r, circle!.a0!, circle!.a1!)} fill="none" stroke={colour} strokeWidth={2.2} strokeDasharray={dash} />
        )}
      </svg>
    );
  }
  if (kind === 'angle') {
    // draw the two arms short, and fill the angle
    const [A, B, C] = pts;
    const u = norm(sub(A, B));
    const w = norm(sub(C, B));
    pts = [add(B, mul2(u, 10)), B, add(B, mul2(w, 10))];
  }
  if (!pts.length) return null;
  let x0 = Math.min(...pts.map((p) => p.x));
  let x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y));
  let y1 = Math.max(...pts.map((p) => p.y));
  const w = Math.max(x1 - x0, 1e-6);
  const h = Math.max(y1 - y0, 1e-6);
  const scale = Math.min((H - 3) / h, 30 / w);
  const W = Math.max(8, w * scale + 3);
  const Hh = Math.max(6, h * scale + 3);
  x0 -= 1.5 / scale;
  y0 -= 1.5 / scale;
  x1 = 0;
  y1 = 0;
  void x1;
  void y1;
  const T = (p: V) => `${((p.x - x0) * scale).toFixed(1)},${((p.y - y0) * scale).toFixed(1)}`;
  return (
    <svg className={`glyph g-${kind}`} width={W} height={Hh} viewBox={`0 0 ${W.toFixed(1)} ${Hh.toFixed(1)}`} aria-hidden="true">
      {kind === 'poly' ? (
        <polygon points={pts.map(T).join(' ')} fill={colour} stroke={colour} strokeWidth={1} />
      ) : kind === 'angle' ? (
        <polygon points={pts.map(T).join(' ')} fill={colour} stroke="none" />
      ) : (
        <polyline points={pts.map(T).join(' ')} fill="none" stroke={colour} strokeWidth={2.4} strokeDasharray={dash} strokeLinecap="round" />
      )}
    </svg>
  );
}

const norm = (p: V) => {
  const l = Math.hypot(p.x, p.y) || 1;
  return v(p.x / l, p.y / l);
};
const mul2 = (p: V, k: number) => v(p.x * k, p.y * k);
