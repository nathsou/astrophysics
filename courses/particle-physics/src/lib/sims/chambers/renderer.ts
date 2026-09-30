/**
 * Draws the droplets and the chamber's background. WebGL2 where available (point sprites with additive blending and a
 * procedural mist), a Canvas 2D fallback with the same look otherwise. The renderer knows nothing about physics: it
 * takes a `DropletField`, a `View` and the current time.
 */
import { STRIDE, FOREVER, type ChamberKind, type DropletField, type View } from './droplets';

export interface RenderParams {
  /** Seconds: droplets appear at their birth time, grow for `grow` s, stay for `hold` s and fade over their life. */
  now: number;
  grow: number;
  hold: number;
  /** Downward drift of droplets in mm/s (they sink as the fog settles). */
  drift: number;
  /** Animate the mist? */
  mist: boolean;
  /** Overall droplet brightness (1 by default). */
  gain?: number;
}

export interface Renderer {
  readonly backend: 'webgl2' | 'canvas2d';
  resize(cssW: number, cssH: number, dpr: number): void;
  render(field: DropletField, view: View, p: RenderParams): void;
  destroy(): void;
}

// ───────────────────────── WebGL2 ─────────────────────────
const VERT = `#version 300 es
precision highp float;
in vec2 aPos; in float aBirth; in float aSize; in float aBright; in float aLife;
uniform vec2 uCenter; uniform float uScale; uniform vec2 uViewport; uniform float uDpr;
uniform float uNow; uniform float uGrow; uniform float uHold; uniform float uMinPx; uniform float uDrift; uniform float uGain;
out float vA; out float vG;
void main() {
  float age = uNow - aBirth;
  float grow = clamp(age / uGrow, 0.0, 1.0);
  float fade = aLife > 1.0e8 ? 1.0 : 1.0 - smoothstep(0.0, 1.0, clamp((age - uHold) / aLife, 0.0, 1.0));
  vA = grow * grow * (3.0 - 2.0 * grow) * fade * aBright * uGain;
  vG = grow;
  if (vA < 0.004 || age < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec2 p = aPos;
  p.y -= uDrift * max(age - uHold * 0.5, 0.0);
  vec2 s = (p - uCenter) * uScale;
  vec2 ndc = vec2(s.x, s.y) / (uViewport * 0.5);
  gl_Position = vec4(ndc, 0.0, 1.0);
  float px = max(uMinPx, aSize * uScale * (0.65 + 0.35 * grow));
  gl_PointSize = px * uDpr;
}`;

const FRAG = `#version 300 es
precision highp float;
in float vA; in float vG;
uniform int uKind;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  vec3 col;
  if (uKind == 0) {
    // a droplet lit from the side: a soft bluish-white glint with a hotter core
    float g = exp(-r2 * 4.2) + 0.30 * exp(-r2 * 1.1);
    col = vec3(0.66, 0.84, 1.0) * g * vA + vec3(1.0, 0.98, 0.92) * exp(-r2 * 14.0) * vA * 0.6;
  } else {
    // a bubble in dark-field light: bright rim, a specular point, a dim centre
    float r = sqrt(r2);
    float rim = smoothstep(0.35, 0.8, r) * (1.0 - smoothstep(0.85, 1.0, r));
    float spec = exp(-dot(c - vec2(-0.3, 0.3), c - vec2(-0.3, 0.3)) * 14.0);
    col = vec3(0.90, 0.95, 1.0) * (rim * 0.75 + spec * 0.9 + 0.22) * vA;
  }
  outColor = vec4(col, 1.0);
}`;

const BG_VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BG_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; uniform float uTime; uniform vec2 uRes; uniform int uKind; uniform float uMist;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.15 * noise(p * 4.1 + 3.3); }
void main() {
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec3 col;
  if (uKind == 0) {
    // the cloud chamber: near-black, a cold glow at the bottom (the chilled plate), slow turbulent mist
    float t = uTime * 0.03 * uMist;
    float m = fbm(q * 2.2 + vec2(t, -t * 0.7)) * fbm(q * 1.3 - vec2(t * 0.6, t));
    float floorGlow = pow(1.0 - uv.y, 5.0);
    col = vec3(0.010, 0.021, 0.031) + vec3(0.030, 0.060, 0.080) * m * (0.5 + 0.9 * (1.0 - uv.y)) + vec3(0.024, 0.056, 0.078) * floorGlow;
    // a soft lamp from the left
    col += vec3(0.010, 0.016, 0.022) * pow(1.0 - uv.x, 3.0) * 0.6;
  } else {
    // the bubble chamber: dark slate with a faint grain, brighter near the centre
    float n = noise(q * 420.0);
    float r = length((uv - 0.5) * vec2(asp, 1.0));
    col = vec3(0.020, 0.026, 0.034) + vec3(0.022, 0.028, 0.034) * (1.0 - smoothstep(0.0, 0.9, r)) + vec3(0.012) * (n - 0.5);
  }
  float vig = smoothstep(1.15, 0.35, length((uv - 0.5) * vec2(1.0, 0.9) * 1.5));
  col *= 0.55 + 0.45 * vig;
  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
  return sh;
}
function program(gl: WebGL2RenderingContext, v: string, f: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, v));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, f));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

class GLRenderer implements Renderer {
  readonly backend = 'webgl2' as const;
  private gl: WebGL2RenderingContext;
  private pd: WebGLProgram;
  private pb: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private bgVao: WebGLVertexArrayObject;
  private uploaded = -1;
  private capacity = 0;
  private uploadedField: DropletField | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private bgLoc: Record<string, WebGLUniformLocation | null> = {};
  private minPx: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private kind: ChamberKind,
    gl: WebGL2RenderingContext,
  ) {
    this.gl = gl;
    this.minPx = kind === 'cloud' ? 2.1 : 2.6;
    this.pd = program(gl, VERT, FRAG);
    this.pb = program(gl, BG_VERT, BG_FRAG);
    for (const n of ['uCenter', 'uScale', 'uViewport', 'uDpr', 'uNow', 'uGrow', 'uHold', 'uMinPx', 'uDrift', 'uGain', 'uKind']) this.loc[n] = gl.getUniformLocation(this.pd, n);
    for (const n of ['uTime', 'uRes', 'uKind', 'uMist']) this.bgLoc[n] = gl.getUniformLocation(this.pb, n);
    this.buf = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const stride = STRIDE * 4;
    const attr = (name: string, size: number, off: number) => {
      const l = gl.getAttribLocation(this.pd, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off * 4);
    };
    attr('aPos', 2, 0);
    attr('aBirth', 1, 2);
    attr('aSize', 1, 3);
    attr('aBright', 1, 4);
    attr('aLife', 1, 5);
    gl.bindVertexArray(null);
    this.bgVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.bgVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(this.pb, 'aPos');
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.w = cssW;
    this.h = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
  }

  render(field: DropletField, view: View, p: RenderParams): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.pb);
    gl.uniform1f(this.bgLoc.uTime!, p.now);
    gl.uniform2f(this.bgLoc.uRes!, this.w, this.h);
    gl.uniform1i(this.bgLoc.uKind!, this.kind === 'cloud' ? 0 : 1);
    gl.uniform1f(this.bgLoc.uMist!, p.mist ? 1 : 0);
    gl.bindVertexArray(this.bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (field.count === 0) return;
    if (this.uploaded !== field.version || this.uploadedField !== field) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const bytes = field.count * STRIDE * 4;
      if (bytes > this.capacity) {
        this.capacity = Math.max(bytes * 2, 1 << 16);
        gl.bufferData(gl.ARRAY_BUFFER, this.capacity, gl.DYNAMIC_DRAW);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, field.data, 0, field.count * STRIDE);
      this.uploaded = field.version;
      this.uploadedField = field;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pd);
    gl.uniform2f(this.loc.uCenter!, view.cx, view.cy);
    gl.uniform1f(this.loc.uScale!, view.scale);
    gl.uniform2f(this.loc.uViewport!, this.w, this.h);
    gl.uniform1f(this.loc.uDpr!, this.dpr);
    gl.uniform1f(this.loc.uNow!, p.now);
    gl.uniform1f(this.loc.uGrow!, p.grow);
    gl.uniform1f(this.loc.uHold!, p.hold);
    gl.uniform1f(this.loc.uMinPx!, this.minPx);
    gl.uniform1f(this.loc.uDrift!, p.drift);
    gl.uniform1f(this.loc.uGain!, p.gain ?? 1);
    gl.uniform1i(this.loc.uKind!, this.kind === 'cloud' ? 0 : 1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, field.count);
    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteProgram(this.pd);
    gl.deleteProgram(this.pb);
    gl.deleteBuffer(this.buf);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

// ───────────────────────── Canvas 2D fallback ─────────────────────────
class CanvasRenderer implements Renderer {
  readonly backend = 'canvas2d' as const;
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private sprite: HTMLCanvasElement;
  private minPx: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private kind: ChamberKind,
    ctx: CanvasRenderingContext2D,
  ) {
    this.ctx = ctx;
    this.minPx = kind === 'cloud' ? 2.1 : 2.6;
    // One pre-rendered sprite, scaled for every droplet.
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const c = s.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === 'cloud') {
      g.addColorStop(0, 'rgba(255,252,240,1)');
      g.addColorStop(0.18, 'rgba(200,228,255,0.85)');
      g.addColorStop(0.55, 'rgba(150,200,255,0.25)');
      g.addColorStop(1, 'rgba(150,200,255,0)');
    } else {
      g.addColorStop(0, 'rgba(225,238,255,0.35)');
      g.addColorStop(0.45, 'rgba(225,238,255,0.25)');
      g.addColorStop(0.78, 'rgba(235,245,255,0.95)');
      g.addColorStop(1, 'rgba(235,245,255,0)');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    this.sprite = s;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.w = cssW;
    this.h = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
  }

  render(field: DropletField, view: View, p: RenderParams): void {
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // Background
    const bg = c.createLinearGradient(0, 0, 0, H);
    if (this.kind === 'cloud') {
      bg.addColorStop(0, '#02060a');
      bg.addColorStop(0.7, '#04101a');
      bg.addColorStop(1, '#0a2230');
    } else {
      bg.addColorStop(0, '#0b1016');
      bg.addColorStop(1, '#10161d');
    }
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    const d = field.data;
    const k = this.dpr;
    const gain = p.gain ?? 1;
    for (let i = 0; i < field.count; i++) {
      const o = i * STRIDE;
      const age = p.now - d[o + 2]!;
      if (age < 0) continue;
      const life = d[o + 5]!;
      const grow = Math.min(1, age / p.grow);
      const fade = life >= FOREVER ? 1 : 1 - Math.min(1, Math.max(0, (age - p.hold) / life));
      const a = grow * grow * (3 - 2 * grow) * fade * d[o + 4]! * gain;
      if (a < 0.01) continue;
      const y = d[o + 1]! - p.drift * Math.max(age - p.hold * 0.5, 0);
      const sx = ((d[o]! - view.cx) * view.scale + this.w / 2) * k;
      const sy = (this.h / 2 - (y - view.cy) * view.scale) * k;
      const px = Math.max(this.minPx, d[o + 3]! * view.scale * (0.65 + 0.35 * grow)) * k * (this.kind === 'cloud' ? 1.9 : 1.45);
      c.globalAlpha = Math.min(1, a * (this.kind === 'cloud' ? 1 : 0.8));
      c.drawImage(this.sprite, sx - px / 2, sy - px / 2, px, px);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  destroy(): void {
    /* nothing to free */
  }
}

/** Raised when a WebGL2 context was obtained but could not be set up; the canvas is then unusable for 2D, so the caller must make a new one. */
export class GLInitError extends Error {}

/** Create the best renderer available for this canvas. `forceCanvas` skips WebGL2 (for tests and for comparison). */
export function createRenderer(canvas: HTMLCanvasElement, kind: ChamberKind, forceCanvas = false): Renderer {
  if (!forceCanvas) {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch {
      gl = null;
    }
    if (gl) {
      try {
        return new GLRenderer(canvas, kind, gl);
      } catch (e) {
        throw new GLInitError(e instanceof Error ? e.message : 'WebGL2 setup failed');
      }
    }
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser cannot draw the chamber (no WebGL2 and no 2D canvas).');
  return new CanvasRenderer(canvas, kind, ctx);
}
