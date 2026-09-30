// Barendregt's λ-cube in 3D (WebGL2), with DOM labels.
//
// Axes:  x = polymorphism (□,*)   y = type operators (□,□)   z = dependency (*,□)

import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { calculi, type CalculusId } from '@kernel/core/calculus.ts';
import { envFor, check } from '../../app/kernel.ts';
import { Playground } from '../Playground.tsx';

interface Vertex {
  id: CalculusId;
  label: string;
  pos: [number, number, number];
  blurb: string;
  example: string;
}

const V: Vertex[] = [
  { id: 'stlc', label: 'λ→', pos: [0, 0, 0], blurb: 'Simply typed λ-calculus: terms depending on terms only.', example: 'variable (A : *)\n#check λ (f : A → A) (x : A) => f (f x)' },
  { id: 'f', label: 'λ2', pos: [1, 0, 0], blurb: 'System F: adds terms depending on types — polymorphism.', example: '#check λ (A : *) (x : A) => x' },
  { id: 'womega', label: 'λω̲', pos: [0, 1, 0], blurb: 'Adds types depending on types — type operators, but no polymorphism.', example: '#check λ (A : *) => A → A' },
  { id: 'fomega', label: 'λω', pos: [1, 1, 0], blurb: 'System Fω: polymorphism and type operators.', example: 'def And\' (A B : *) : * := Π (X : *), (A → B → X) → X\n#check λ (A B : *) (p : And\' A B) => p A (λ (a : A) (b : B) => a)' },
  { id: 'lp', label: 'λP', pos: [0, 0, 1], blurb: 'LF: adds types depending on terms — dependent types.', example: 'variable (N : *) (P : N → *)\n#check λ (n : N) (h : P n) => h' },
  { id: 'lp2', label: 'λP2', pos: [1, 0, 1], blurb: 'Dependent types and polymorphism: second-order predicate logic.', example: 'variable (N : *)\n#check λ (P : N → *) (n : N) (h : P n) => h' },
  { id: 'lpw', label: 'λPω̲', pos: [0, 1, 1], blurb: 'Dependent types and type operators, without polymorphism.', example: 'variable (N : *)\n#check λ (P : N → *) (n : N) => P n → P n' },
  { id: 'coc', label: 'λC', pos: [1, 1, 1], blurb: 'The Calculus of Constructions: all four dependencies.', example: '#check λ (A : *) (P : A → *) (a : A) (h : Π (Q : A → *), Q a) => h P' },
];

const EDGES: [number, number][] = [];
for (let i = 0; i < 8; i++)
  for (let j = i + 1; j < 8; j++) {
    const d = V[i].pos.map((x, k) => Math.abs(x - V[j].pos[k])).reduce((a, b) => a + b, 0);
    if (d === 1) EDGES.push([i, j]);
  }

type Vec3 = [number, number, number];

function project(p: Vec3, yaw: number, pitch: number, W: number, H: number): { x: number; y: number; z: number; s: number } {
  // centre the cube
  let [x, y, z] = [p[0] - 0.5, -(p[1] - 0.5), p[2] - 0.5];
  // yaw around y
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  // pitch around x
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const dist = 3.2;
  const f = Math.min(W, H) * 1.35;
  const s = f / (dist + z);
  return { x: W / 2 + x * s, y: H / 2 + y * s, z, s };
}

const VS = `#version 300 es
in vec2 aPos; in vec4 aColor; in float aSize;
uniform vec2 uRes;
out vec4 vColor;
void main() {
  vec2 c = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = aSize;
  vColor = aColor;
}`;
const FS = `#version 300 es
precision mediump float;
in vec4 vColor; out vec4 o;
uniform bool uPoints;
void main() {
  if (uPoints) {
    float r = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.2, r);
    o = vec4(vColor.rgb, vColor.a * core);
  } else o = vColor;
}`;

function rgb(name: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const c = document.createElement('canvas').getContext('2d')!;
  c.fillStyle = v || '#888';
  const s = c.fillStyle as string;
  if (s.startsWith('#')) {
    const n = parseInt(s.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = /\(([^)]+)\)/.exec(s);
  const [r, g, b] = (m ? m[1] : '128,128,128').split(',').map((x) => parseFloat(x) / 255);
  return [r, g, b];
}

export function CubeViz(props: { initial?: string }) {
  let canvas!: HTMLCanvasElement;
  let wrap!: HTMLDivElement;
  const labels: HTMLDivElement[] = [];
  const [sel, setSel] = createSignal<number>(Math.max(0, V.findIndex((v) => v.id === props.initial)));
  const [probe, setProbe] = createSignal('λ (A : *) (x : A) => x');
  let yaw = -0.6;
  let pitch = 0.42;
  let drag: { x: number; y: number; yaw: number; pitch: number } | undefined;
  let lastInteraction = 0;
  let raf = 0;
  let gl: WebGL2RenderingContext | null = null;
  let prog: WebGLProgram | null = null;

  const accepted = createMemo(() => {
    const src = probe().trim();
    if (!src) return V.map(() => false);
    return V.map((v) => {
      try {
        const r = check(`#check ${src}`, envFor(v.id));
        return !r.messages.some((m) => m.severity === 'error');
      } catch {
        return false;
      }
    });
  });

  const draw = () => {
    const W = wrap.clientWidth;
    const H = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    if (!drag && performance.now() - lastInteraction > 4000) yaw += 0.003;
    const P = V.map((v) => project(v.pos, yaw, pitch, W, H));
    const ink = rgb('--ink-3');
    const acc = rgb('--accent');
    const ok = rgb('--ok');
    const sel0 = sel();
    const acceptedV = accepted();
    if (gl && prog) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog);
      gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), W, H);
      const lines: number[] = [];
      const axisCol = (i: number, j: number): [number, number, number] => {
        const k = V[i].pos.findIndex((x, t) => x !== V[j].pos[t]);
        return k === 0 ? rgb('--c-type') : k === 1 ? rgb('--c-sort') : rgb('--c-prop');
      };
      for (const [i, j] of EDGES) {
        const c = axisCol(i, j);
        const a = 0.35 + 0.35 * (1 - (P[i].z + P[j].z + 1.5) / 3);
        lines.push(P[i].x * dpr, P[i].y * dpr, ...c, a, 1, P[j].x * dpr, P[j].y * dpr, ...c, a, 1);
      }
      draw1(gl, prog, new Float32Array(lines), gl.LINES, W * dpr, H * dpr, false);
      const pts: number[] = [];
      P.forEach((p, i) => {
        const c = i === sel0 ? acc : acceptedV[i] ? ok : ink;
        const size = (i === sel0 ? 46 : acceptedV[i] ? 34 : 22) * dpr * (p.s / (Math.min(W, H) * 0.42));
        pts.push(p.x * dpr, p.y * dpr, ...c, i === sel0 || acceptedV[i] ? 0.55 : 0.3, size);
      });
      draw1(gl, prog, new Float32Array(pts), gl.POINTS, W * dpr, H * dpr, true);
    }
    // labels
    P.forEach((p, i) => {
      const el = labels[i];
      if (!el) return;
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${0.75 + 0.35 * (1 - (p.z + 0.9) / 1.8)})`;
      el.style.zIndex = String(Math.round(100 - p.z * 50));
      el.classList.toggle('on', i === sel0);
      el.classList.toggle('ok', acceptedV[i]);
    });
    raf = requestAnimationFrame(draw);
  };

  const draw1 = (gl: WebGL2RenderingContext, p: WebGLProgram, data: Float32Array, prim: number, W: number, H: number, points: boolean) => {
    gl.uniform2f(gl.getUniformLocation(p, 'uRes'), W, H);
    gl.uniform1i(gl.getUniformLocation(p, 'uPoints'), points ? 1 : 0);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const stride = 7 * 4;
    const a = (n: string) => gl.getAttribLocation(p, n);
    gl.enableVertexAttribArray(a('aPos'));
    gl.vertexAttribPointer(a('aPos'), 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(a('aColor'));
    gl.vertexAttribPointer(a('aColor'), 4, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(a('aSize'));
    gl.vertexAttribPointer(a('aSize'), 1, gl.FLOAT, false, stride, 24);
    gl.drawArrays(prim, 0, data.length / 7);
    gl.deleteBuffer(buf);
  };

  onMount(() => {
    gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
    if (gl) {
      const mk = (t: number, s: string) => {
        const sh = gl!.createShader(t)!;
        gl!.shaderSource(sh, s);
        gl!.compileShader(sh);
        return sh;
      };
      prog = gl.createProgram()!;
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
    }
    raf = requestAnimationFrame(draw);
  });
  onCleanup(() => cancelAnimationFrame(raf));

  const v = () => V[sel()];
  const rules = () => (calculi[v().id].cube?.rules ?? []).map(([a, b]) => `(${a ? '□' : '*'}, ${b ? '□' : '*'})`);

  return (
    <div class="widget wide cube">
      <div class="widget-head">
        <span class="widget-title">The λ-cube</span>
        <span class="legend" style={{ 'margin-left': '0.6rem' }}>
          <span style={{ color: 'var(--c-type)' }}>→ polymorphism (□,*)</span>
          <span style={{ color: 'var(--c-sort)' }}>↑ type operators (□,□)</span>
          <span style={{ color: 'var(--c-prop)' }}>↗ dependent types (*,□)</span>
        </span>
      </div>
      <div class="cube-grid">
        <div
          class="cube-stage"
          ref={wrap}
          onPointerDown={(e) => {
            drag = { x: e.clientX, y: e.clientY, yaw, pitch };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
            pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.008));
            lastInteraction = performance.now();
          }}
          onPointerUp={() => {
            drag = undefined;
            lastInteraction = performance.now();
          }}
        >
          <canvas ref={canvas} />
          <For each={V}>
            {(vx, i) => (
              <div class="cube-label" ref={(el) => (labels[i()] = el)} onPointerDown={(e) => e.stopPropagation()} onClick={() => setSel(i())}>
                {vx.label}
              </div>
            )}
          </For>
        </div>
        <div class="cube-side sans">
          <div class="cube-name">
            {v().label} <span class="muted">· {calculi[v().id].name}</span>
          </div>
          <p>{v().blurb}</p>
          <div class="label">product rules R</div>
          <div class="cube-rules">
            <For each={rules()}>{(r) => <code>{r}</code>}</For>
          </div>
          <div class="label" style={{ 'margin-top': '0.9rem' }}>
            where does this term live?
          </div>
          <input class="input" style={{ width: '100%' }} value={probe()} onInput={(e) => setProbe(e.currentTarget.value)} spellcheck={false} />
          <div class="cube-accept">
            <For each={V}>
              {(vx, i) => (
                <span class={`badge ${accepted()[i()] ? 'ok' : ''}`} title={accepted()[i()] ? 'typechecks here' : 'rejected here'}>
                  {vx.label}
                </span>
              )}
            </For>
          </div>
          <div class="muted" style={{ 'font-size': '0.75rem', 'margin-top': '0.4rem' }}>
            Green vertices accept the term. Drag the cube to rotate it; click a vertex to select that calculus.
          </div>
        </div>
      </div>
      <Show when={v()} keyed>
        {(vx) => <Playground code={vx.example} calculus={vx.id} title={`Try ${vx.label}`} class="cube-pg" />}
      </Show>
    </div>
  );
}
