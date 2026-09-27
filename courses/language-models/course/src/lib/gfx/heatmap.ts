/**
 * GPU heatmap renderer: one full-screen triangle, the matrix in a storage buffer (WebGPU) or an
 * R32F texture (WebGL2), and a colour LUT. Handles millions of cells at interactive rates,
 * which the attention/weight/gradient visualisations later in the course rely on.
 */
import { getDevice } from '$lib/gpu/device';

export interface HeatmapParams {
  rows: number;
  cols: number;
  /** Value range mapped to the ends of the colour ramp (already in log space if `log`). */
  vmin: number;
  vmax: number;
  log: boolean;
  /** Hovered cell, or -1. */
  hiRow: number;
  hiCol: number;
  /** Gap between cells in device pixels (0 for dense matrices). */
  gap: number;
  surface: [number, number, number];
  ink: [number, number, number];
}

export interface HeatmapRenderer {
  readonly backend: 'webgpu' | 'webgl2';
  setData(values: Float32Array, rows: number, cols: number): void;
  setColormap(lut: Uint8Array<ArrayBuffer>): void;
  render(p: HeatmapParams, width: number, height: number): void;
  destroy(): void;
}

const WGSL = /* wgsl */ `
struct U {
  dims: vec2f, size: vec2f, range: vec2f, hi: vec2f,
  surface: vec4f, ink: vec4f,
  gap: f32, logScale: f32, _p0: f32, _p1: f32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> data: array<f32>;
@group(0) @binding(2) var cmap: texture_2d<f32>;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let cell = u.size / u.dims;
  let cf = pos.xy / cell;
  let c = min(floor(cf), u.dims - 1.0);
  let local = (cf - c) * cell;
  let half = u.gap * 0.5;
  if (u.gap > 0.0 && (local.x < half || local.y < half || local.x > cell.x - half || local.y > cell.y - half)) {
    return u.surface;
  }
  var v = data[u32(c.y) * u32(u.dims.x) + u32(c.x)];
  if (u.logScale > 0.5) { v = log(max(v, 1e-30)); }
  let t = clamp((v - u.range.x) / max(u.range.y - u.range.x, 1e-30), 0.0, 1.0);
  var col = textureLoad(cmap, vec2i(i32(t * 255.0 + 0.5), 0), 0);
  let onRow = c.y == u.hi.y;
  let onCol = c.x == u.hi.x;
  if (onRow && onCol) {
    let edge = min(min(local.x - half, cell.x - half - local.x), min(local.y - half, cell.y - half - local.y));
    if (edge < max(1.5, min(cell.x, cell.y) * 0.12)) { return u.ink; }
  } else if (onRow || onCol) {
    col = mix(col, u.ink, 0.1);
  }
  return col;
}
`;

async function createWebGPU(canvas: HTMLCanvasElement): Promise<HeatmapRenderer | null> {
  const device = await getDevice();
  if (!device) return null;
  const ctx = canvas.getContext('webgpu');
  if (!ctx) return null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const module = device.createShaderModule({ code: WGSL });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const uniform = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const cmap = device.createTexture({ size: [256, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  let data: GPUBuffer | null = null;
  let bind: GPUBindGroup | null = null;

  const rebind = () => {
    if (!data) return;
    bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: data } },
        { binding: 2, resource: cmap.createView() },
      ],
    });
  };

  return {
    backend: 'webgpu',
    setData(values) {
      const bytes = Math.max(16, values.byteLength);
      if (!data || data.size < bytes) {
        data?.destroy();
        data = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        rebind();
      }
      device.queue.writeBuffer(data, 0, values.buffer, values.byteOffset, values.byteLength);
    },
    setColormap(lut) {
      device.queue.writeTexture({ texture: cmap }, lut, { bytesPerRow: 256 * 4 }, [256, 1]);
    },
    render(p, width, height) {
      if (!bind) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const u = new Float32Array(24);
      u.set([p.cols, p.rows, width, height, p.vmin, p.vmax, p.hiCol, p.hiRow]);
      u.set([...p.surface.map((x) => x / 255), 1], 8);
      u.set([...p.ink.map((x) => x / 255), 1], 12);
      u.set([p.gap, p.log ? 1 : 0], 16);
      device.queue.writeBuffer(uniform, 0, u);
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
    },
    destroy() {
      data?.destroy();
      uniform.destroy();
      cmap.destroy();
      ctx.unconfigure();
    },
  };
}

const VS = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D data;
uniform sampler2D cmap;
uniform vec2 dims, size, range, hi;
uniform vec4 surface, ink;
uniform float gap, logScale;
out vec4 outColor;
void main() {
  vec2 pos = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec2 cell = size / dims;
  vec2 cf = pos / cell;
  vec2 c = min(floor(cf), dims - 1.0);
  vec2 local = (cf - c) * cell;
  float h = gap * 0.5;
  if (gap > 0.0 && (local.x < h || local.y < h || local.x > cell.x - h || local.y > cell.y - h)) { outColor = surface; return; }
  float v = texelFetch(data, ivec2(c), 0).r;
  if (logScale > 0.5) v = log(max(v, 1e-30));
  float t = clamp((v - range.x) / max(range.y - range.x, 1e-30), 0.0, 1.0);
  vec4 col = texelFetch(cmap, ivec2(int(t * 255.0 + 0.5), 0), 0);
  bool onRow = c.y == hi.y, onCol = c.x == hi.x;
  if (onRow && onCol) {
    float edge = min(min(local.x - h, cell.x - h - local.x), min(local.y - h, cell.y - h - local.y));
    if (edge < max(1.5, min(cell.x, cell.y) * 0.12)) { outColor = ink; return; }
  } else if (onRow || onCol) col = mix(col, ink, 0.1);
  outColor = col;
}`;

function createWebGL2(canvas: HTMLCanvasElement): HeatmapRenderer | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  const loc = (n: string) => gl.getUniformLocation(prog, n);
  const tex = (unit: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const dataTex = tex(0);
  const cmapTex = tex(1);
  const vao = gl.createVertexArray();
  return {
    backend: 'webgl2',
    setData(values, rows, cols) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, cols, rows, 0, gl.RED, gl.FLOAT, values);
    },
    setColormap(lut) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cmapTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    },
    render(p, width, height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1i(loc('data'), 0);
      gl.uniform1i(loc('cmap'), 1);
      gl.uniform2f(loc('dims'), p.cols, p.rows);
      gl.uniform2f(loc('size'), width, height);
      gl.uniform2f(loc('range'), p.vmin, p.vmax);
      gl.uniform2f(loc('hi'), p.hiCol, p.hiRow);
      gl.uniform4f(loc('surface'), p.surface[0] / 255, p.surface[1] / 255, p.surface[2] / 255, 1);
      gl.uniform4f(loc('ink'), p.ink[0] / 255, p.ink[1] / 255, p.ink[2] / 255, 1);
      gl.uniform1f(loc('gap'), p.gap);
      gl.uniform1f(loc('logScale'), p.log ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteTexture(dataTex);
      gl.deleteTexture(cmapTex);
      gl.deleteProgram(prog);
    },
  };
}

/** Create the best available renderer. A canvas can only hold one context type, so WebGL2 needs a fresh canvas. */
export async function createHeatmapRenderer(makeCanvas: () => HTMLCanvasElement, prefer: 'webgpu' | 'webgl2' = 'webgpu'): Promise<HeatmapRenderer | null> {
  if (prefer === 'webgpu') {
    const r = await createWebGPU(makeCanvas()).catch(() => null);
    if (r) return r;
  }
  return createWebGL2(makeCanvas());
}
