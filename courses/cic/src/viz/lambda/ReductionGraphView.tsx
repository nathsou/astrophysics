// The graph of all reduction paths of a term, laid out by a force simulation
// and rendered with WebGL2 (falling back to Canvas 2D).

import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { type RGraph, type U, type Strategy, reductionGraph, normalize, dbKey, toDB, print, expandDefs } from '@kernel/untyped/lambda.ts';
import { showTooltip, hideTooltip } from '../tooltip.ts';
import { isDark, palette, theme } from '../../app/theme.ts';

interface Sim {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
}

function cssColor(name: string, fallback: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = v;
  const hex = c.fillStyle as string;
  if (hex.startsWith('#')) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(hex);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
    return [r / 255, g / 255, b / 255];
  }
  return [0.5, 0.5, 0.5];
}

const VS = `#version 300 es
in vec2 aPos; in vec4 aColor; in float aSize;
uniform vec2 uScale; uniform vec2 uOffset;
out vec4 vColor;
void main() {
  gl_Position = vec4((aPos + uOffset) * uScale, 0.0, 1.0);
  gl_PointSize = aSize;
  vColor = aColor;
}`;
const FS_POINT = `#version 300 es
precision mediump float;
in vec4 vColor; out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  float a = smoothstep(0.5, 0.42, r);
  float ring = smoothstep(0.34, 0.40, r) * a;
  outColor = vec4(mix(vColor.rgb, vColor.rgb * 0.6, ring), vColor.a * a);
}`;
const FS_LINE = `#version 300 es
precision mediump float;
in vec4 vColor; out vec4 outColor;
void main() { outColor = vColor; }`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

export function ReductionGraphView(props: { term: U; defs?: Map<string, U>; strategy?: Strategy; maxNodes?: number; height?: number }) {
  let canvas!: HTMLCanvasElement;
  let wrap!: HTMLDivElement;
  const graph = createMemo<RGraph>(() => reductionGraph(props.term, props.defs, props.maxNodes ?? 250));
  const [info, setInfo] = createSignal('');
  const [mode, setMode] = createSignal<'webgl' | '2d'>('webgl');
  // the path taken by the chosen strategy
  const stratPath = createMemo(() => {
    const g = graph();
    const idx = new Map(g.nodes.map((n) => [n.key, n.id]));
    const t = props.defs ? expandDefs(props.term, props.defs) : props.term;
    const r = normalize(t, props.strategy ?? 'normal', undefined, 200, 400);
    const ids: number[] = [idx.get(dbKey(toDB(t)))!];
    for (const s of r.steps) {
      const id = idx.get(dbKey(toDB(s.term)));
      if (id === undefined) break;
      ids.push(id);
    }
    return ids;
  });

  let sim: Sim | undefined;
  let raf = 0;
  let ticks = 0;
  let view = { cx: 0, cy: 0, zoom: 1 };
  let hover = -1;
  let gl: WebGL2RenderingContext | null = null;
  let progs: { point: WebGLProgram; line: WebGLProgram } | undefined;
  let ctx2d: CanvasRenderingContext2D | null = null;

  const initSim = () => {
    const g = graph();
    const n = g.nodes.length;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const perDepth = new Map<number, number>();
    for (const nd of g.nodes) {
      const k = perDepth.get(nd.depth) ?? 0;
      perDepth.set(nd.depth, k + 1);
      x[nd.id] = nd.depth * 40 + (Math.random() - 0.5) * 4;
      y[nd.id] = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 30 + (Math.random() - 0.5) * 4;
    }
    sim = { x, y, vx: new Float32Array(n), vy: new Float32Array(n) };
    ticks = 0;
    fit();
  };

  const step = () => {
    if (!sim) return;
    const g = graph();
    const n = g.nodes.length;
    const { x, y, vx, vy } = sim;
    const alpha = Math.max(0.02, 1 - ticks / 300);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        if (d2 > 90000) continue;
        const f = (900 / d2) * alpha;
        vx[i] += dx * f;
        vy[i] += dy * f;
        vx[j] -= dx * f;
        vy[j] -= dy * f;
      }
    }
    for (const e of g.edges) {
      const dx = x[e.to] - x[e.from];
      const dy = y[e.to] - y[e.from];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - 38) / d) * 0.08 * alpha;
      vx[e.from] += dx * f;
      vy[e.from] += dy * f;
      vx[e.to] -= dx * f;
      vy[e.to] -= dy * f;
      // gentle left-to-right flow: reductions go rightwards
      vx[e.to] += 0.6 * alpha;
      vx[e.from] -= 0.6 * alpha;
    }
    for (let i = 0; i < n; i++) {
      vx[i] *= 0.6;
      vy[i] *= 0.6;
      vy[i] -= y[i] * 0.002 * alpha;
      x[i] += vx[i];
      y[i] += vy[i];
    }
    ticks++;
  };

  const fit = () => {
    if (!sim) return;
    const n = graph().nodes.length;
    let minx = Infinity,
      maxx = -Infinity,
      miny = Infinity,
      maxy = -Infinity;
    for (let i = 0; i < n; i++) {
      minx = Math.min(minx, sim.x[i]);
      maxx = Math.max(maxx, sim.x[i]);
      miny = Math.min(miny, sim.y[i]);
      maxy = Math.max(maxy, sim.y[i]);
    }
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 300;
    view.cx = (minx + maxx) / 2;
    view.cy = (miny + maxy) / 2;
    view.zoom = Math.min(2.5, 0.85 * Math.min(w / Math.max(40, maxx - minx), h / Math.max(40, maxy - miny)));
  };

  const colors = () => ({
    ink: cssColor('--ink-3', '#888'),
    ok: cssColor('--ok', '#1f8a4c'),
    accent: cssColor('--accent', '#3d4bd6'),
    node: cssColor('--c-type', '#1a64b8'),
    hot: cssColor('--hl-redex-border', '#e0a800'),
  });

  const render = () => {
    if (!sim) return;
    const g = graph();
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const c = colors();
    const onPath = new Set(stratPath());
    const pathEdges = new Set<string>();
    const sp = stratPath();
    for (let i = 0; i + 1 < sp.length; i++) pathEdges.add(`${sp[i]}>${sp[i + 1]}`);
    const nodeColor = (id: number): [number, number, number, number] => {
      const nd = g.nodes[id];
      if (id === 0) return [...c.accent, 1];
      if (nd.normal) return [...c.ok, 1];
      if (onPath.has(id)) return [...c.hot, 1];
      return [...c.node, 0.85];
    };
    const nodeSize = (id: number) => (id === hover ? 16 : id === 0 || g.nodes[id].normal ? 13 : 9) * dpr;
    if (mode() === 'webgl' && gl && progs) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const scale = [(2 * view.zoom) / W, (-2 * view.zoom) / H];
      const offset = [-view.cx, -view.cy];
      // edges
      const ev = new Float32Array(g.edges.length * 2 * 7);
      g.edges.forEach((e, i) => {
        const hot = pathEdges.has(`${e.from}>${e.to}`);
        const col = hot ? c.hot : c.ink;
        const o = i * 14;
        ev.set([sim!.x[e.from], sim!.y[e.from], ...col, hot ? 0.5 : 0.15], o);
        ev.set([sim!.x[e.to], sim!.y[e.to], ...col, hot ? 1 : 0.7], o + 7);
      });
      drawBuffer(gl, progs.line, ev, 7, gl.LINES, scale, offset, false);
      const nv = new Float32Array(g.nodes.length * 7);
      g.nodes.forEach((nd) => nv.set([sim!.x[nd.id], sim!.y[nd.id], ...nodeColor(nd.id), nodeSize(nd.id)], nd.id * 7));
      drawBuffer(gl, progs.point, nv, 7, gl.POINTS, scale, offset, true);
    } else if (ctx2d) {
      const ctx = ctx2d;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const tx = (x: number) => (x - view.cx) * view.zoom + W / 2;
      const ty = (y: number) => (y - view.cy) * view.zoom + H / 2;
      for (const e of g.edges) {
        const hot = pathEdges.has(`${e.from}>${e.to}`);
        ctx.strokeStyle = `rgba(${(hot ? c.hot : c.ink).map((v) => v * 255).join(',')},${hot ? 0.9 : 0.4})`;
        ctx.lineWidth = hot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(tx(sim.x[e.from]), ty(sim.y[e.from]));
        ctx.lineTo(tx(sim.x[e.to]), ty(sim.y[e.to]));
        ctx.stroke();
      }
      for (const nd of g.nodes) {
        const [r, gg, b, a] = nodeColor(nd.id);
        ctx.fillStyle = `rgba(${r * 255},${gg * 255},${b * 255},${a})`;
        ctx.beginPath();
        ctx.arc(tx(sim.x[nd.id]), ty(sim.y[nd.id]), nodeSize(nd.id) / dpr / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawBuffer = (gl: WebGL2RenderingContext, prog: WebGLProgram, data: Float32Array, stride: number, prim: number, scale: number[], offset: number[], points: boolean) => {
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const loc = (n: string) => gl.getAttribLocation(prog, n);
    const aPos = loc('aPos');
    const aColor = loc('aColor');
    const aSize = loc('aSize');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride * 4, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride * 4, 8);
    if (aSize >= 0) {
      if (points) {
        gl.enableVertexAttribArray(aSize);
        gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride * 4, 24);
      } else {
        gl.disableVertexAttribArray(aSize);
        gl.vertexAttrib1f(aSize, 1);
      }
    }
    gl.uniform2fv(gl.getUniformLocation(prog, 'uScale'), scale);
    gl.uniform2fv(gl.getUniformLocation(prog, 'uOffset'), offset);
    gl.drawArrays(prim, 0, data.length / stride);
    gl.deleteBuffer(buf);
  };

  const loop = () => {
    if (ticks < 320) {
      for (let k = 0; k < 2; k++) step();
      if (ticks % 20 === 0 && ticks < 200) fit();
    }
    render();
    raf = requestAnimationFrame(loop);
  };

  onMount(() => {
    gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
    if (gl) {
      try {
        progs = { point: compile(gl, VS, FS_POINT), line: compile(gl, VS, FS_LINE) };
      } catch {
        gl = null;
      }
    }
    if (!gl) {
      setMode('2d');
      ctx2d = canvas.getContext('2d');
    }
    raf = requestAnimationFrame(loop);
  });
  onCleanup(() => cancelAnimationFrame(raf));
  createEffect(() => {
    void graph();
    initSim();
  });
  createEffect(() => {
    void theme();
    void isDark();
    void palette();
  });

  // interaction
  let drag: { x: number; y: number; cx: number; cy: number } | undefined;
  const pick = (e: MouseEvent): number => {
    if (!sim) return -1;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left - r.width / 2) / view.zoom + view.cx;
    const my = (e.clientY - r.top - r.height / 2) / view.zoom + view.cy;
    let best = -1;
    let bd = (10 / view.zoom) ** 2;
    for (let i = 0; i < graph().nodes.length; i++) {
      const d = (sim.x[i] - mx) ** 2 + (sim.y[i] - my) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const onMove = (e: MouseEvent) => {
    if (drag) {
      view.cx = drag.cx - (e.clientX - drag.x) / view.zoom;
      view.cy = drag.cy - (e.clientY - drag.y) / view.zoom;
      return;
    }
    const p = pick(e);
    hover = p;
    if (p >= 0) {
      const nd = graph().nodes[p];
      const out = graph().edges.filter((x) => x.from === p).length;
      showTooltip(e.clientX, e.clientY, `${print(nd.term)}\n\n${p === 0 ? 'start · ' : ''}${nd.normal ? 'normal form' : `${out} redex${out === 1 ? '' : 'es'}`} · ${nd.depth} step${nd.depth === 1 ? '' : 's'} from the start`);
    } else hideTooltip();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view.zoom = Math.max(0.1, Math.min(8, view.zoom * Math.exp(-e.deltaY * 0.0015)));
  };

  createEffect(() => {
    const g = graph();
    const nf = g.nodes.filter((n) => n.normal).length;
    setInfo(`${g.nodes.length} term${g.nodes.length === 1 ? '' : 's'}, ${g.edges.length} reduction step${g.edges.length === 1 ? '' : 's'}${g.truncated ? ' (truncated)' : ''} · ${nf} normal form${nf === 1 ? '' : 's'}`);
  });

  return (
    <div class="rgraph" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ height: `${props.height ?? 320}px` }}
        onMouseMove={onMove}
        onMouseDown={(e) => (drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy })}
        onMouseUp={() => (drag = undefined)}
        onMouseLeave={() => {
          drag = undefined;
          hover = -1;
          hideTooltip();
        }}
        onWheel={onWheel}
        onDblClick={fit}
      />
      <div class="rgraph-legend sans">
        <span class="lg start">start</span>
        <span class="lg path">{props.strategy ?? 'normal'} order path</span>
        <span class="lg nf">normal form</span>
        <span class="grow" />
        <span class="muted">{info()}</span>
        <Show when={mode() === '2d'}>
          <span class="badge">canvas fallback</span>
        </Show>
      </div>
    </div>
  );
}
