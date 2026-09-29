/**
 * The WebGL 2 renderer of the voltage landscape (no libraries): flat-shaded triangles with per-vertex
 * colour, translucent glass for the lift, thin lines for the grid and the ruler, and the balls as lit point
 * sprites. Everything is drawn from the plain data of landscape.ts.
 */
import { BALL_RADIUS, type Scene } from './landscape';
import { viewProjection, type Camera, type Vec3 } from './mat4';

export interface GLColours {
  ball: [number, number, number];
  /** Light direction (unit vector, world space). */
  light: Vec3;
}

const MESH_VS = `#version 300 es
in vec3 a_pos;
in vec3 a_nrm;
in vec4 a_col;
uniform mat4 u_mvp;
out vec3 v_nrm;
out vec4 v_col;
void main() {
  v_nrm = a_nrm;
  v_col = a_col;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;

const MESH_FS = `#version 300 es
precision mediump float;
in vec3 v_nrm;
in vec4 v_col;
uniform vec3 u_light;
out vec4 o;
void main() {
  float shade = 1.0;
  if (length(v_nrm) > 0.5) shade = 0.5 + 0.62 * max(dot(normalize(v_nrm), u_light), 0.0);
  o = vec4(v_col.rgb * shade * v_col.a, v_col.a);
}`;

const BALL_VS = `#version 300 es
in vec3 a_pos;
uniform mat4 u_mvp;
uniform float u_size;
uniform float u_ortho;
void main() {
  vec4 p = u_mvp * vec4(a_pos, 1.0);
  gl_Position = p;
  gl_PointSize = u_ortho > 0.5 ? u_size : u_size / max(p.w, 0.1);
}`;

const BALL_FS = `#version 300 es
precision mediump float;
uniform vec3 u_ball;
uniform vec3 u_light;
out vec4 o;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  vec3 n = vec3(p.x, -p.y, sqrt(1.0 - r2));
  float d = max(dot(n, normalize(vec3(-0.35, 0.75, 0.55))), 0.0);
  vec3 c = u_ball * (0.5 + 0.7 * d) + vec3(0.4) * pow(d, 14.0);
  o = vec4(c, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
  return p;
}

interface MeshBuffers {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
}

export class GLRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly meshProgram: WebGLProgram;
  private readonly ballProgram: WebGLProgram;
  private opaque?: MeshBuffers;
  private glass?: MeshBuffers;
  private lines?: MeshBuffers;
  private lastScene?: Scene;
  private readonly ballVao: WebGLVertexArrayObject;
  private readonly ballBuffer: WebGLBuffer;
  private ballCapacity = 0;
  private width = 1;
  private height = 1;
  lost = false;

  private constructor(private readonly canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.meshProgram = program(gl, MESH_VS, MESH_FS);
    this.ballProgram = program(gl, BALL_VS, BALL_FS);
    this.ballVao = gl.createVertexArray()!;
    this.ballBuffer = gl.createBuffer()!;
    canvas.addEventListener('webglcontextlost', this.onLost);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };

  /** A renderer for the canvas, or null when WebGL 2 is not available. */
  static create(canvas: HTMLCanvasElement): GLRenderer | null {
    try {
      const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
      return gl ? new GLRenderer(canvas, gl) : null;
    } catch {
      return null;
    }
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.width = w;
    this.height = h;
  }

  private upload(data: { pos: number[]; nrm?: number[]; col: number[] }): MeshBuffers {
    const gl = this.gl;
    const prog = this.meshProgram;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    const attr = (name: string, values: number[] | undefined, size: number) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      if (!values) {
        // A constant attribute (lines are unlit: their normal is zero).
        gl.disableVertexAttribArray(loc);
        gl.vertexAttrib3f(loc, 0, 0, 0);
        return;
      }
      const b = gl.createBuffer()!;
      buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('a_pos', data.pos, 3);
    attr('a_nrm', data.nrm, 3);
    attr('a_col', data.col, 4);
    gl.bindVertexArray(null);
    return { vao, buffers, count: data.pos.length / 3 };
  }

  private free(m: MeshBuffers | undefined): void {
    if (!m) return;
    this.gl.deleteVertexArray(m.vao);
    for (const b of m.buffers) this.gl.deleteBuffer(b);
  }

  private setScene(scene: Scene): void {
    this.free(this.opaque);
    this.free(this.glass);
    this.free(this.lines);
    this.opaque = this.upload(scene.opaque);
    this.glass = this.upload(scene.glass);
    this.lines = this.upload({ pos: scene.lines.pos, col: scene.lines.col });
    this.lastScene = scene;
  }

  draw(scene: Scene, balls: Vec3[], camera: Camera, colours: GLColours): void {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return;
    if (scene !== this.lastScene) this.setScene(scene);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const mvp = viewProjection(camera, this.width / this.height);
    gl.useProgram(this.meshProgram);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'u_mvp'), false, mvp);
    gl.uniform3fv(gl.getUniformLocation(this.meshProgram, 'u_light'), colours.light);

    const drawMesh = (m: MeshBuffers | undefined, mode: number) => {
      if (!m || m.count === 0) return;
      gl.bindVertexArray(m.vao);
      gl.drawArrays(mode, 0, m.count);
    };
    drawMesh(this.opaque, gl.TRIANGLES);
    // Lines are unlit: their normal attribute is the constant zero vector.
    gl.vertexAttrib3f(gl.getAttribLocation(this.meshProgram, 'a_nrm'), 0, 0, 0);
    drawMesh(this.lines, gl.LINES);

    // Balls: point sprites sized by distance.
    if (balls.length) {
      const data = new Float32Array(balls.length * 3);
      balls.forEach((b, i) => data.set(b, i * 3));
      gl.useProgram(this.ballProgram);
      gl.bindVertexArray(this.ballVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ballBuffer);
      if (balls.length > this.ballCapacity) {
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        this.ballCapacity = balls.length;
      } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      const loc = gl.getAttribLocation(this.ballProgram, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.ballProgram, 'u_mvp'), false, mvp);
      // Diameter in device pixels: for a perspective camera it is R·H / (tan(fov/2)·w); for an orthographic one it is fixed.
      const t = Math.tan(camera.fov / 2);
      gl.uniform1f(gl.getUniformLocation(this.ballProgram, 'u_size'), camera.ortho ? (BALL_RADIUS * this.height) / (camera.distance * t) : (BALL_RADIUS * this.height) / t);
      gl.uniform1f(gl.getUniformLocation(this.ballProgram, 'u_ortho'), camera.ortho ? 1 : 0);
      gl.uniform3fv(gl.getUniformLocation(this.ballProgram, 'u_ball'), colours.ball);
      gl.uniform3fv(gl.getUniformLocation(this.ballProgram, 'u_light'), colours.light);
      gl.drawArrays(gl.POINTS, 0, balls.length);
    }

    // The glass of the lift last, without writing depth.
    gl.useProgram(this.meshProgram);
    gl.depthMask(false);
    drawMesh(this.glass, gl.TRIANGLES);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    const gl = this.gl;
    this.free(this.opaque);
    this.free(this.glass);
    this.free(this.lines);
    gl.deleteBuffer(this.ballBuffer);
    gl.deleteVertexArray(this.ballVao);
    gl.deleteProgram(this.meshProgram);
    gl.deleteProgram(this.ballProgram);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
