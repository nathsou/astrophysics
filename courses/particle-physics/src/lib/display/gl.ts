/**
 * The WebGL2 renderer of the 3D view. Everything is instanced: line segments (screen-space quads with a glow profile and
 * dashes), point sprites for hits, frustum towers for calorimeter cells and cones for jets. The instance buffers are built
 * once per event (see glData.ts); a frame only sets uniforms and issues four instanced draw calls, allocating nothing.
 *
 * Highlighting is done in the shaders: every instance carries the id of its object, and a small R8 texture maps an id to its
 * state (normal, related, primary, dimmed), so hovering an object costs one 256-wide texture upload.
 */
import type { Camera } from './camera.ts';
import { buildCones, buildPoints, buildSegments, buildTowers, CONE_STRIDE, POINT_STRIDE, SEG_STRIDE, TOWER_STRIDE, type RenderOptions } from './glData.ts';
import type { DisplayScene } from './scene.ts';

const STATE_LIB = /* glsl */ `
uniform highp sampler2D uState;
uniform int uHasSel;
uniform float uNeutralDim;
// 0 normal, 1 related, 2 primary, 3 dimmed, 4 neutral while something is selected
int stateOf(float idf) {
  if (idf < -0.5) return uHasSel == 1 ? 4 : 0;
  int id = int(idf + 0.5);
  return int(texelFetch(uState, ivec2(id & 255, id >> 8), 0).r * 255.0 + 0.5);
}
`;

const SEG_VS = /* glsl */ `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aP0;
layout(location=2) in vec3 aP1;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aInfo;
uniform mat4 uVP; uniform vec2 uViewport; uniform float uDpr; uniform float uClipW; uniform vec2 uFog; uniform float uGlow;
out vec4 vCol; out float vSide; out float vHalf; out float vS; out float vDash; out float vWhite; out float vGlow;
${STATE_LIB}
void main() {
  int st = stateOf(aInfo.w);
  vec4 c0 = uVP * vec4(aP0, 1.0);
  vec4 c1 = uVP * vec4(aP1, 1.0);
  if (c0.w < uClipW && c1.w < uClipW) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vCol = vec4(0.0); vSide = 0.0; vHalf = 0.0; vS = 0.0; vDash = 0.0; vWhite = 0.0; vGlow = 0.0;
    return;
  }
  float k0 = c0.w < uClipW ? (uClipW - c0.w) / (c1.w - c0.w) : 0.0;
  float k1 = c1.w < uClipW ? (uClipW - c0.w) / (c1.w - c0.w) : 1.0;
  vec4 a = mix(c0, c1, k0);
  vec4 b = mix(c0, c1, k1);
  vec2 hv = uViewport * 0.5;
  vec2 pa = a.xy / a.w * hv;
  vec2 pb = b.xy / b.w * hv;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wMul = st == 2 ? 2.0 : (st == 1 ? 1.5 : 1.0);
  float halfW = 0.5 * aInfo.x * uDpr * wMul;
  float gw = 1.3 * uDpr;
  float reach = halfW + (uGlow > 0.5 ? 2.0 * gw : 0.8 * uDpr);
  float t = aCorner.x;
  vec4 c = mix(a, b, t);
  vec2 off = dir * (t * 2.0 - 1.0) * reach + nrm * aCorner.y * reach;
  gl_Position = vec4(c.xy + off / hv * c.w, c.z, c.w);
  float fog = uFog.y > uFog.x ? mix(1.0, 0.42, clamp((c.w - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0)) : 1.0;
  float dimF = st == 3 ? 0.16 : (st == 4 ? uNeutralDim : 1.0);
  vCol = vec4(aCol.rgb, aCol.a * fog * dimF);
  vSide = aCorner.y * reach;
  vHalf = halfW;
  vS = aInfo.z + t * length(aP1 - aP0);
  vDash = aInfo.y;
  vWhite = st == 2 ? 0.55 : (st == 1 ? 0.18 : 0.0);
  vGlow = (st == 3 || st == 4 || uGlow < 0.5) ? 0.0 : 1.0;
}`;

const SEG_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol; in float vSide; in float vHalf; in float vS; in float vDash; in float vWhite; in float vGlow;
uniform float uDpr;
out vec4 o;
void main() {
  if (vDash > 0.0 && fract(vS / vDash) > 0.5) discard;
  float d = abs(vSide);
  float aa = 0.8 * uDpr;
  float core = 1.0 - smoothstep(vHalf - aa, vHalf + aa, d);
  float gw = 1.3 * uDpr;
  float x = max(d - vHalf, 0.0) / gw;
  float g = exp(-0.5 * x * x) * 0.45 * vGlow;
  float I = core + (1.0 - core) * g;
  float centre = 1.0 - smoothstep(0.0, max(vHalf, 0.5 * uDpr), d);
  vec3 col = mix(vCol.rgb, vec3(1.0), clamp(vWhite + 0.3 * centre * vGlow, 0.0, 1.0));
  o = vec4(col * I * vCol.a, 1.0);
}`;

const PT_VS = /* glsl */ `#version 300 es
precision highp float; precision highp int;
layout(location=1) in vec3 aPos;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aInfo;
uniform mat4 uVP; uniform float uDpr; uniform float uClipW; uniform vec2 uFog;
out vec4 vCol; out float vShape; out float vWhite;
${STATE_LIB}
void main() {
  int st = stateOf(aInfo.z);
  vec4 c = uVP * vec4(aPos, 1.0);
  if (c.w < uClipW) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vCol = vec4(0.0); vShape = 0.0; vWhite = 0.0; return; }
  gl_Position = c;
  gl_PointSize = aInfo.x * uDpr * (st == 2 ? 2.2 : (st == 1 ? 1.6 : 1.0));
  float fog = uFog.y > uFog.x ? mix(1.0, 0.42, clamp((c.w - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0)) : 1.0;
  float dimF = st == 3 ? 0.14 : (st == 4 ? uNeutralDim : 1.0);
  vCol = vec4(aCol.rgb, aCol.a * fog * dimF);
  vShape = aInfo.y;
  vWhite = st == 2 ? 0.6 : (st == 1 ? 0.2 : 0.0);
}`;

const PT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol; in float vShape; in float vWhite;
out vec4 o;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  float a;
  if (vShape < 0.5) a = 1.0 - smoothstep(0.55, 1.0, r);
  else if (vShape < 1.5) { float q = abs(uv.x) + abs(uv.y); a = 1.0 - smoothstep(0.7, 1.0, q); }
  else a = max(smoothstep(0.5, 0.65, r) * (1.0 - smoothstep(0.85, 1.0, r)), 1.0 - smoothstep(0.2, 0.35, r));
  vec3 col = mix(vCol.rgb, vec3(1.0), vWhite);
  o = vec4(col * a * vCol.a, 1.0);
}`;

const TW_VS = /* glsl */ `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 aCorner;
layout(location=1) in vec4 aG0;
layout(location=2) in vec4 aG1;
layout(location=3) in vec4 aCol;
uniform mat4 uVP; uniform float uFlip;
out vec3 vC; out vec3 vPos; out vec4 vCol; out float vSt;
${STATE_LIB}
void main() {
  int st = stateOf(aG1.z);
  float cx = (uFlip * aG0.x > 0.0) ? 1.0 - aCorner.x : aCorner.x;
  float e = aG0.x + (cx - 0.5) * aG0.z;
  float p = aG0.y + (aCorner.y - 0.5) * aG0.w;
  float t = mix(aG1.x, aG1.y, aCorner.z);
  float ch = cosh(e);
  vec3 pos = t * vec3(cos(p) / ch, sin(p) / ch, tanh(e));
  gl_Position = uVP * vec4(pos, 1.0);
  vC = vec3(cx, aCorner.y, aCorner.z);
  vPos = pos;
  float dimF = st == 3 ? 0.22 : (st == 4 ? uNeutralDim : 1.0);
  vCol = vec4(aCol.rgb, aCol.a * dimF);
  vSt = float(st);
}`;

const TW_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vC; in vec3 vPos; in vec4 vCol; in float vSt;
out vec4 o;
void main() {
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  float lam = 0.42 + 0.58 * abs(dot(n, normalize(vec3(0.35, 0.8, 0.5))));
  vec3 e = min(vC, 1.0 - vC);
  vec3 fw = max(fwidth(vC), vec3(1e-5));
  vec3 m = e / fw;
  float mid = max(min(m.x, m.y), min(max(m.x, m.y), m.z));
  float edge = 1.0 - smoothstep(0.4, 1.4, mid);
  float top = smoothstep(0.97, 1.0, vC.z);
  float prim = vSt > 1.5 && vSt < 2.5 ? 1.0 : 0.0;
  float rel = vSt > 0.5 && vSt < 1.5 ? 1.0 : 0.0;
  vec3 col = vCol.rgb * lam * mix(0.65, 1.0, vC.z);
  col = mix(col, vec3(1.0), 0.25 * prim + 0.08 * rel);
  col += vCol.rgb * edge * 0.7;
  float a = clamp(vCol.a + 0.25 * top + 0.35 * edge + 0.3 * prim, 0.0, 1.0);
  if (vSt > 2.5) a *= 0.6;
  o = vec4(col, a);
}`;

const CONE_VS = /* glsl */ `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 aVert;
layout(location=1) in vec4 aG0;
layout(location=2) in vec4 aO;
layout(location=3) in vec4 aCol;
uniform mat4 uVP;
out vec4 vCol; out float vZ;
${STATE_LIB}
void main() {
  int st = stateOf(aO.w);
  float ch = cosh(aG0.x);
  vec3 a = vec3(cos(aG0.y) / ch, sin(aG0.y) / ch, tanh(aG0.x));
  vec3 ref = abs(a.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 e1 = normalize(cross(a, ref));
  vec3 e2 = cross(a, e1);
  float z = aVert.z;
  vec3 pos = aO.xyz + a * aG0.z * z + (e1 * aVert.x + e2 * aVert.y) * aG0.w * aG0.z * z;
  gl_Position = uVP * vec4(pos, 1.0);
  float dimF = st == 3 ? 0.3 : (st == 4 ? uNeutralDim : 1.0);
  float boost = st == 2 ? 2.2 : (st == 1 ? 1.5 : 1.0);
  vCol = vec4(aCol.rgb, aCol.a * dimF * boost);
  vZ = z;
}`;

const CONE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol; in float vZ;
out vec4 o;
void main() { o = vec4(vCol.rgb, vCol.a * (0.5 + 0.8 * vZ)); }`;

const BG_VS = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const BG_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uViewport;
out vec4 o;
void main() {
  vec2 q = (vUV - 0.5) * vec2(uViewport.x / uViewport.y, 1.0);
  float r = length(q);
  vec3 centre = vec3(0.050, 0.075, 0.108);
  vec3 edge = vec3(0.012, 0.019, 0.031);
  o = vec4(mix(centre, edge, smoothstep(0.0, 0.85, r)), 1.0);
}`;

interface Prog {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export interface GlStats {
  segments: number;
  points: number;
  towers: number;
  cones: number;
}

/** The renderer. Throws in the constructor if WebGL2 is not available. */
export class EventGL {
  readonly gl: WebGL2RenderingContext;
  readonly stats: GlStats = { segments: 0, points: 0, towers: 0, cones: 0 };
  private seg!: Prog;
  private pt!: Prog;
  private tw!: Prog;
  private cone!: Prog;
  private bg!: Prog;
  private vaoSeg!: WebGLVertexArrayObject;
  private vaoPt!: WebGLVertexArrayObject;
  private vaoTw!: WebGLVertexArrayObject;
  private vaoCone!: WebGLVertexArrayObject;
  private vaoEmpty!: WebGLVertexArrayObject;
  private bufSeg!: WebGLBuffer;
  private bufPt!: WebGLBuffer;
  private bufTw!: WebGLBuffer;
  private bufCone!: WebGLBuffer;
  private bufStatic: WebGLBuffer[] = [];
  private stateTex!: WebGLTexture;
  private stateBytes = new Uint8Array(256);
  private stateH = 1;
  private hasSel = 0;
  private coneVerts = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private fogOn = true;
  private disposed = false;
  /** Sign applied to the tower η flip so that faces are wound consistently (see the tower vertex shader). */
  private towerFlip = 1;
  /** Above this many line segments the glow around lines is dropped, to keep the fill rate down. */
  glowMax = 12000;

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: { antialias?: boolean } = {},
  ) {
    const gl = canvas.getContext('webgl2', { antialias: opts.antialias ?? false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.init();
  }

  /** Whether this browser can create a WebGL2 context. */
  static isSupported(): boolean {
    try {
      const c = document.createElement('canvas');
      const ok = !!c.getContext('webgl2');
      return ok;
    } catch {
      return false;
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  private program(vs: string, fs: string, uniforms: string[]): Prog {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  private staticBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.bufStatic.push(b);
    return b;
  }

  private init(): void {
    const gl = this.gl;
    const common = ['uVP', 'uViewport', 'uDpr', 'uClipW', 'uFog', 'uState', 'uHasSel', 'uNeutralDim', 'uGlow'];
    this.seg = this.program(SEG_VS, SEG_FS, common);
    this.pt = this.program(PT_VS, PT_FS, common);
    this.tw = this.program(TW_VS, TW_FS, ['uVP', 'uFlip', 'uState', 'uHasSel', 'uNeutralDim']);
    this.cone = this.program(CONE_VS, CONE_FS, ['uVP', 'uState', 'uHasSel', 'uNeutralDim']);
    this.bg = this.program(BG_VS, BG_FS, ['uViewport']);

    this.bufSeg = gl.createBuffer()!;
    this.bufPt = gl.createBuffer()!;
    this.bufTw = gl.createBuffer()!;
    this.bufCone = gl.createBuffer()!;

    // Segment quad: (t, side).
    const segQuad = this.staticBuffer(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
    this.vaoSeg = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoSeg);
    gl.bindBuffer(gl.ARRAY_BUFFER, segQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSeg);
    const ss = SEG_STRIDE * 4;
    this.instAttr(1, 3, ss, 0);
    this.instAttr(2, 3, ss, 12);
    this.instAttr(3, 4, ss, 24);
    this.instAttr(4, 4, ss, 40);

    // Points: one vertex per point (gl.POINTS), no instancing.
    this.vaoPt = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoPt);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPt);
    const ps = POINT_STRIDE * 4;
    for (const [loc, size, off] of [[1, 3, 0], [2, 4, 12], [3, 4, 28]] as const) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, ps, off);
    }

    // Tower cube: 6 faces × 2 triangles, corners in {0,1}³, outward-facing counter-clockwise.
    const faces = [
      [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0],
      [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
      [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
      [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
    ];
    const cube: number[] = [];
    for (const f of faces) for (const k of [0, 1, 2, 0, 2, 3]) cube.push(f[3 * k]!, f[3 * k + 1]!, f[3 * k + 2]!);
    const cubeBuf = this.staticBuffer(new Float32Array(cube));
    this.vaoTw = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoTw);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufTw);
    const ts = TOWER_STRIDE * 4;
    this.instAttr(1, 4, ts, 0);
    this.instAttr(2, 4, ts, 16);
    this.instAttr(3, 4, ts, 32);

    // Cone mesh: a fan from the apex (z = 0) to the base ring (z = 1).
    const N = 36;
    const cone: number[] = [];
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      cone.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a0), Math.sin(a0), 1, Math.cos(a1), Math.sin(a1), 1);
    }
    this.coneVerts = cone.length / 3;
    const coneBuf = this.staticBuffer(new Float32Array(cone));
    this.vaoCone = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoCone);
    gl.bindBuffer(gl.ARRAY_BUFFER, coneBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCone);
    const cs = CONE_STRIDE * 4;
    this.instAttr(1, 4, cs, 0);
    this.instAttr(2, 4, cs, 16);
    this.instAttr(3, 4, cs, 32);

    this.vaoEmpty = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    // State texture.
    this.stateTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.allocState(1);
  }

  private instAttr(loc: number, size: number, stride: number, offset: number): void {
    const gl = this.gl;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(loc, 1);
  }

  private allocState(nObjects: number): void {
    const gl = this.gl;
    const h = Math.max(1, Math.ceil(nObjects / 256));
    this.stateH = h;
    this.stateBytes = new Uint8Array(256 * h);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, h, 0, gl.RED, gl.UNSIGNED_BYTE, this.stateBytes);
  }

  /** Load the instance buffers for a scene under the given options. */
  setScene(scene: DisplayScene, o: RenderOptions): void {
    const gl = this.gl;
    const seg = buildSegments(scene, o);
    const pts = buildPoints(scene, o);
    const tw = buildTowers(scene, o);
    const co = buildCones(scene, o);
    const upload = (buf: WebGLBuffer, data: Float32Array) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    };
    upload(this.bufSeg, seg.view());
    upload(this.bufPt, pts.view());
    upload(this.bufTw, tw.view());
    upload(this.bufCone, co.view());
    this.stats.segments = seg.count;
    this.stats.points = pts.count;
    this.stats.towers = tw.count;
    this.stats.cones = co.count;
    if (this.stateH * 256 < scene.objects.length) this.allocState(scene.objects.length);
    else this.stateBytes.fill(0);
    this.hasSel = 0;
    this.uploadState();
  }

  /** Set the highlight states (one byte per object id), or null for no selection. */
  setHighlight(states: Uint8Array | null): void {
    if (states === null) {
      if (this.hasSel === 0) return;
      this.hasSel = 0;
      this.stateBytes.fill(0);
    } else {
      if (states.length > this.stateBytes.length) this.allocState(states.length);
      this.stateBytes.set(states);
      this.hasSel = 1;
    }
    this.uploadState();
  }

  private uploadState(): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, this.stateH, gl.RED, gl.UNSIGNED_BYTE, this.stateBytes);
  }

  /** Resize the drawing buffer to `width`×`height` CSS pixels at device pixel ratio `dpr`. */
  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.dpr = dpr;
    const w = Math.round(this.width * dpr), h = Math.round(this.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Draw one frame. Allocates nothing. */
  render(cam: Camera): void {
    if (this.disposed) return;
    const gl = this.gl;
    const W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ZERO);
    // Background.
    gl.useProgram(this.bg.p);
    gl.uniform2f(this.bg.u.uViewport!, W, H);
    gl.bindVertexArray(this.vaoEmpty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex);
    const neutral = 0.35;

    // Towers: translucent, back faces culled.
    if (this.stats.towers > 0) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.tw.p);
      gl.uniformMatrix4fv(this.tw.u.uVP!, false, cam.viewProj);
      gl.uniform1f(this.tw.u.uFlip!, this.towerFlip);
      gl.uniform1i(this.tw.u.uState!, 0);
      gl.uniform1i(this.tw.u.uHasSel!, this.hasSel);
      gl.uniform1f(this.tw.u.uNeutralDim!, neutral);
      gl.bindVertexArray(this.vaoTw);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.stats.towers);
      gl.disable(gl.CULL_FACE);
    }
    // Jet cones.
    if (this.stats.cones > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.cone.p);
      gl.uniformMatrix4fv(this.cone.u.uVP!, false, cam.viewProj);
      gl.uniform1i(this.cone.u.uState!, 0);
      gl.uniform1i(this.cone.u.uHasSel!, this.hasSel);
      gl.uniform1f(this.cone.u.uNeutralDim!, neutral);
      gl.bindVertexArray(this.vaoCone);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.coneVerts, this.stats.cones);
    }
    // Lines and points: each pixel keeps the brightest contribution, so joints and crossings do not add up.
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    const vw = cam.width * this.dpr, vh = cam.height * this.dpr;
    const clipW = cam.ortho ? 0 : cam.near;
    const fogA = this.fogOn && !cam.ortho ? cam.distance * 0.7 : 0;
    const fogB = this.fogOn && !cam.ortho ? cam.distance * 1.7 : 0;
    const setCommon = (p: Prog) => {
      gl.uniformMatrix4fv(p.u.uVP!, false, cam.viewProj);
      gl.uniform2f(p.u.uViewport!, vw, vh);
      gl.uniform1f(p.u.uDpr!, this.dpr);
      gl.uniform1f(p.u.uClipW!, clipW);
      gl.uniform2f(p.u.uFog!, fogA, fogB);
      gl.uniform1i(p.u.uState!, 0);
      gl.uniform1i(p.u.uHasSel!, this.hasSel);
      gl.uniform1f(p.u.uNeutralDim!, neutral);
      gl.uniform1f(p.u.uGlow!, this.stats.segments <= this.glowMax ? 1 : 0);
    };
    if (this.stats.segments > 0) {
      gl.useProgram(this.seg.p);
      setCommon(this.seg);
      gl.bindVertexArray(this.vaoSeg);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.stats.segments);
    }
    if (this.stats.points > 0) {
      gl.useProgram(this.pt.p);
      setCommon(this.pt);
      gl.bindVertexArray(this.vaoPt);
      gl.drawArrays(gl.POINTS, 0, this.stats.points);
    }
    gl.bindVertexArray(null);
  }

  /** Enable or disable the depth fog. */
  setFog(on: boolean): void {
    this.fogOn = on;
  }

  /** Flip the winding correction of the tower faces (for diagnosing a rendering problem). */
  setTowerFlip(f: 1 | -1): void {
    this.towerFlip = f;
  }

  /** Read back one pixel, for tests and diagnostics (CSS pixel coordinates, origin top left). */
  readPixel(x: number, y: number): [number, number, number] {
    const gl = this.gl;
    const b = new Uint8Array(4);
    gl.readPixels(Math.round(x * this.dpr), Math.round(this.canvas.height - y * this.dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return [b[0]!, b[1]!, b[2]!];
  }

  /** Render `frames` frames and wait for the GPU; returns the mean milliseconds per frame. */
  benchmark(cam: Camera, frames = 30): number {
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      cam.orbit(0.01, 0);
      cam.update();
      this.render(cam);
    }
    this.readPixel(1, 1); // reading a pixel back waits for the GPU to finish
    return (performance.now() - t0) / frames;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const b of [this.bufSeg, this.bufPt, this.bufTw, this.bufCone, ...this.bufStatic]) gl.deleteBuffer(b);
    for (const p of [this.seg, this.pt, this.tw, this.cone, this.bg]) gl.deleteProgram(p.p);
    for (const v of [this.vaoSeg, this.vaoPt, this.vaoTw, this.vaoCone, this.vaoEmpty]) gl.deleteVertexArray(v);
    gl.deleteTexture(this.stateTex);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
