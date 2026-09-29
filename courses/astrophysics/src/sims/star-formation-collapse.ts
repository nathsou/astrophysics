// Chapter 7 flagship: collapse and fragmentation of a turbulent, self-gravitating molecular cloud.
// GPU smoothed-particle hydrodynamics (SPH) with an isothermal + barotropic equation of state,
// hashed-grid neighbour search (counting sort + prefix sum), tiled direct-sum gravity and sink particles.
//
// Code units: G = 1, cloud mass M = 1, cloud radius R = 1. Physical scaling: M = 100 M☉, R = 0.5 pc, so
// the velocity unit is sqrt(GM/R) ≈ 0.93 km/s and the time unit R/V ≈ 0.53 Myr (t_ff ≈ 0.59 Myr).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { OrbitCamera } from '../lib/runtime/camera';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { blackbodyRGB } from '../lib/physics/blackbody';
import { onThemeChange, currentTheme } from '../lib/ui/theme';
import sphCode from './star-formation/sph.wgsl?raw';
import renderCode from './star-formation/render.wgsl?raw';

const M_CLOUD = 100; // M☉
const R_CLOUD_PC = 0.5;
const kB = 1.380649e-23, mH = 1.6735575e-27, G_SI = 6.6743e-11, MSUN = 1.98847e30, PC = 3.0856775814913673e16;
const V_UNIT = Math.sqrt((G_SI * M_CLOUD * MSUN) / (R_CLOUD_PC * PC)); // m/s
const T_UNIT_MYR = (R_CLOUD_PC * PC) / V_UNIT / 3.15576e13;
const RHO0 = 3 / (4 * Math.PI);
const T_FF = Math.sqrt((3 * Math.PI) / (32 * RHO0)); // code units (≈ 1.11)
const HASH_T = 65536;
const SMAX = 128;
const ETA = 1.13; // h = η (m/ρ)^(1/3) → ~48 neighbours inside 2h

const csCode = (T: number) => Math.sqrt((kB * T) / (2.33 * mH)) / V_UNIT;
const jeansMassCode = (T: number, rho = RHO0) => ((Math.PI ** 2.5) / 6) * csCode(T) ** 3 / Math.sqrt(rho);

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Profile = 'uniform' | 'be';
interface IC { N: number; profile: Profile; alphaTurb: number; betaRot: number; seed: number }

/** Initial conditions on the CPU: positions, turbulent + rotational velocities, smoothing lengths. */
function makeIC(o: IC) {
  const { N } = o;
  const rnd = mulberry32(o.seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const m = 1 / N;
  const a = 0.25; // core radius of the centrally condensed ("Bonnor–Ebert-like") profile ρ ∝ 1/(1 + r²/a²)
  const shape = (r: number) => (o.profile === 'uniform' ? 1 : 1 / (1 + (r * r) / (a * a)));
  // tabulate M(r) for inverse-CDF sampling and the gravitational binding energy
  const NT = 2000, Mr = new Float64Array(NT + 1);
  for (let k = 1; k <= NT; k++) { const r = (k - 0.5) / NT; Mr[k] = Mr[k - 1] + 4 * Math.PI * r * r * shape(r) / NT; }
  const norm = 1 / Mr[NT];
  let Egrav = 0;
  for (let k = 1; k <= NT; k++) { const r = k / NT; Egrav -= (Mr[k] * norm) * (Mr[k] - Mr[k - 1]) * norm / r; }
  const rhoAt = (r: number) => shape(r) * norm;

  const pos = new Float32Array(N * 4), vel = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = rnd();
    let lo = 0, hi = NT; // binary search the cumulative mass
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Mr[mid] * norm < u) lo = mid; else hi = mid; }
    const f = (u - Mr[lo] * norm) / Math.max((Mr[hi] - Mr[lo]) * norm, 1e-12);
    const r = (lo + f) / NT;
    const z = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z);
    pos[i * 4] = r * s * Math.cos(ph); pos[i * 4 + 1] = r * s * Math.sin(ph); pos[i * 4 + 2] = r * z; pos[i * 4 + 3] = m;
    vel[i * 4 + 3] = ETA * Math.cbrt(m / rhoAt(r));
  }

  // Solenoidal random field with |v_k| ∝ k⁻² (power spectrum P(k) ∝ k⁻⁴, like supersonic turbulence).
  const modes: number[] = [];
  const KMAX = 6;
  for (let nx = 0; nx <= KMAX; nx++)
    for (let ny = -KMAX; ny <= KMAX; ny++)
      for (let nz = -KMAX; nz <= KMAX; nz++) {
        const n2 = nx * nx + ny * ny + nz * nz;
        if (n2 === 0 || n2 > KMAX * KMAX || (nx === 0 && (ny < 0 || (ny === 0 && nz < 0)))) continue;
        const kx = (Math.PI * nx) / 2, ky = (Math.PI * ny) / 2, kz = (Math.PI * nz) / 2, k2 = kx * kx + ky * ky + kz * kz;
        let ax = gauss(), ay = gauss(), az = gauss();
        const d = (ax * kx + ay * ky + az * kz) / k2; ax -= d * kx; ay -= d * ky; az -= d * kz; // ⟂ k: ∇·v = 0
        const amp = 1 / k2; // |k|⁻²
        modes.push(kx, ky, kz, ax * amp, ay * amp, az * amp, 2 * Math.PI * rnd());
      }
  let mvx = 0, mvy = 0, mvz = 0;
  for (let i = 0; i < N; i++) {
    const x = pos[i * 4], y = pos[i * 4 + 1], z = pos[i * 4 + 2];
    let vx = 0, vy = 0, vz = 0;
    for (let q = 0; q < modes.length; q += 7) {
      const s = Math.sin(modes[q] * x + modes[q + 1] * y + modes[q + 2] * z + modes[q + 6]);
      vx += modes[q + 3] * s; vy += modes[q + 4] * s; vz += modes[q + 5] * s;
    }
    vel[i * 4] = vx; vel[i * 4 + 1] = vy; vel[i * 4 + 2] = vz;
    mvx += vx; mvy += vy; mvz += vz;
  }
  mvx /= N; mvy /= N; mvz /= N;
  let ek = 0, I = 0;
  for (let i = 0; i < N; i++) {
    vel[i * 4] -= mvx; vel[i * 4 + 1] -= mvy; vel[i * 4 + 2] -= mvz;
    ek += 0.5 * m * (vel[i * 4] ** 2 + vel[i * 4 + 1] ** 2 + vel[i * 4 + 2] ** 2);
    I += m * (pos[i * 4] ** 2 + pos[i * 4 + 1] ** 2);
  }
  // virial ratio α = 2 E_kin / |E_grav|;  rotation β = E_rot / |E_grav|
  const sc = ek > 0 ? Math.sqrt((0.5 * o.alphaTurb * Math.abs(Egrav)) / ek) : 0;
  const omega = Math.sqrt((2 * o.betaRot * Math.abs(Egrav)) / I);
  for (let i = 0; i < N; i++) {
    vel[i * 4] = vel[i * 4] * sc - omega * pos[i * 4 + 1];
    vel[i * 4 + 1] = vel[i * 4 + 1] * sc + omega * pos[i * 4];
    vel[i * 4 + 2] *= sc;
  }
  return { pos, vel, Egrav };
}

const COUNTS: Record<string, number> = { '8k': 8192, '16k': 16384, '32k': 32768 };

export default defineSim({
  gpu: true,
  async mount({ host, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9, maxDpr: 1.5 });
    // The scene is always black space (the render pass clears to opaque black); paint the canvas black
    // up front too, so the light HUD text stays readable before the first GPU frame lands.
    stage.canvas.style.background = '#000';
    const { ctx, format } = configureCanvas(stage.canvas, device);

    const check = (mod: GPUShaderModule, name: string) => {
      if (import.meta.env.DEV) mod.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`${name}:${m.lineNum}: ${m.message}`)));
    };
    const sphMod = device.createShaderModule({ code: sphCode, label: 'sf-sph' });
    const renMod = device.createShaderModule({ code: renderCode, label: 'sf-render' });
    check(sphMod, 'sph.wgsl'); check(renMod, 'render.wgsl');

    // ---- one explicit layout shared by all compute kernels (1 uniform + 7 storage buffers) ----
    const C = GPUShaderStage.COMPUTE;
    const simBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: C, buffer: { type: 'uniform' } },
        ...[1, 2, 3, 4, 5, 6, 7].map((b) => ({ binding: b, visibility: C, buffer: { type: 'storage' as const } })),
      ],
    });
    const simLayout = device.createPipelineLayout({ bindGroupLayouts: [simBGL] });
    const kernel = (entryPoint: string) => device.createComputePipeline({ layout: simLayout, compute: { module: sphMod, entryPoint } });
    const K = {
      clearGrid: kernel('clearGrid'), countCells: kernel('countCells'), scanBlocks: kernel('scanBlocks'),
      scanTotals: kernel('scanTotals'), scanAdd: kernel('scanAdd'), scatter: kernel('scatter'),
      density: kernel('density'), forces: kernel('forces'), createSinks: kernel('createSinks'),
      gravity: kernel('gravity'), finalizeStep: kernel('finalizeStep'), integrate: kernel('integrate'),
      accrete: kernel('accrete'), sinkUpdate: kernel('sinkUpdate'),
    };

    const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const renBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: VF, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const toneBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: VF, buffer: { type: 'uniform' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
      ],
    });
    const additive: GPUBlendState = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    const splat = (vs: string, fs: string) => device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renBGL] }),
      vertex: { module: renMod, entryPoint: vs },
      fragment: { module: renMod, entryPoint: fs, targets: [{ format: 'rgba16float', blend: additive }] },
      primitive: { topology: 'triangle-list' },
    });
    const gasPipe = splat('vsGas', 'fsGas');
    const starPipe = splat('vsStar', 'fsStar');
    const tonePipe = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [toneBGL] }),
      vertex: { module: renMod, entryPoint: 'vsFull' },
      fragment: { module: renMod, entryPoint: 'fsTone', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const paramBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const renUBuf = device.createBuffer({ size: 64 + 16 * 4 + 16 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const ST_WORDS = 64 + 8 * SMAX;
    const readBuf = [0, 1].map(() => device.createBuffer({ size: 64 + SMAX * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }));
    const readBusy = [false, false];

    // ---- per-particle-count resources ----
    let N = 0, NB = 0;
    let bufs: GPUBuffer[] = [];
    let bodiesBuf!: GPUBuffer, velBuf!: GPUBuffer, auxBuf!: GPUBuffer, stBuf!: GPUBuffer;
    let simBG!: GPUBindGroup, renBG!: GPUBindGroup;
    let h0 = 0.07;

    function allocate(n: number) {
      bufs.forEach((b) => b.destroy());
      N = n; NB = n + SMAX;
      const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
      bodiesBuf = device.createBuffer({ size: NB * 16, usage: S });
      velBuf = device.createBuffer({ size: NB * 16, usage: S });
      const accBuf = device.createBuffer({ size: NB * 16, usage: S });
      auxBuf = device.createBuffer({ size: N * 16, usage: S });
      const gridBuf = device.createBuffer({ size: (HASH_T + HASH_T / 1024) * 4, usage: S });
      const sortedBuf = device.createBuffer({ size: N * 48, usage: S });
      stBuf = device.createBuffer({ size: ST_WORDS * 4, usage: S });
      bufs = [bodiesBuf, velBuf, accBuf, auxBuf, gridBuf, sortedBuf, stBuf];
      simBG = device.createBindGroup({
        layout: simBGL,
        entries: [{ binding: 0, resource: { buffer: paramBuf } }, ...bufs.map((b, i) => ({ binding: i + 1, resource: { buffer: b } }))],
      });
      renBG = device.createBindGroup({
        layout: renBGL,
        entries: [
          { binding: 0, resource: { buffer: renUBuf } },
          { binding: 1, resource: { buffer: bodiesBuf } },
          { binding: 2, resource: { buffer: velBuf } },
          { binding: 3, resource: { buffer: auxBuf } },
        ],
      });
    }

    // ---- HDR target ----
    let hdrTex: GPUTexture | null = null, toneBG!: GPUBindGroup;
    function makeHDR() {
      hdrTex?.destroy();
      hdrTex = device.createTexture({
        size: [Math.max(1, stage.canvas.width), Math.max(1, stage.canvas.height)],
        format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      toneBG = device.createBindGroup({ layout: toneBGL, entries: [{ binding: 0, resource: { buffer: renUBuf } }, { binding: 4, resource: hdrTex.createView() }] });
    }

    // ---- state & parameters ----
    let count = '16k';
    let profile: Profile = 'uniform';
    let Tgas = 10, alphaTurb = 0.8, betaRot = 0.02, speed = 2;
    let seed = 1;
    const params = new ArrayBuffer(80);
    const pu = new Uint32Array(params), pf = new Float32Array(params);

    function writeParams() {
      const m = 1 / N;
      h0 = ETA * Math.cbrt(m / RHO0);
      const hmin = h0 / 2.5, cell = 2 * hmin;
      pu[0] = N; pu[1] = NB; pu[2] = HASH_T; pu[3] = SMAX;
      pf[4] = cell; pf[5] = 1 / cell; pf[6] = m; pf[7] = csCode(Tgas) ** 2;
      pf[8] = 15 * RHO0; pf[9] = 25 * RHO0; pf[10] = hmin; pf[11] = 3 * hmin;
      pf[12] = ETA; pf[13] = (0.7 * hmin) ** 2; pf[14] = 2 * hmin; pf[15] = 0.003;
      pf[16] = 1; pf[17] = 2; pf[18] = 0.3; pf[19] = 1e-6;
      device.queue.writeBuffer(paramBuf, 0, params);
    }

    let simTime = 0, nSinks = 0, starMass = 0, maxStar = 0, steps = 0;
    function reset() {
      const n = COUNTS[count];
      if (n !== N) allocate(n);
      writeParams();
      const ic = makeIC({ N, profile, alphaTurb, betaRot, seed: seed++ });
      const bodies = new Float32Array(NB * 4), vel = new Float32Array(NB * 4);
      bodies.set(ic.pos); vel.set(ic.vel);
      device.queue.writeBuffer(bodiesBuf, 0, bodies);
      device.queue.writeBuffer(velBuf, 0, vel);
      device.queue.writeBuffer(auxBuf, 0, new Float32Array(N * 4).fill(RHO0));
      const st = new Uint32Array(ST_WORDS);
      st[0] = new Uint32Array(new Float32Array([1e9]).buffer)[0];
      device.queue.writeBuffer(stBuf, 0, st);
      simTime = 0; nSinks = 0; starMass = 0; maxStar = 0; steps = 0;
      jeansRO.set(`${fmt(jeansMassCode(Tgas) * M_CLOUD, 2)} M☉ (${fmt(1 / jeansMassCode(Tgas), 2)} per cloud)`);
    }

    // ---- simulation step (all on the GPU, no CPU round trip) ----
    function encodeSteps(enc: GPUCommandEncoder, n: number) {
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, simBG);
      const run = (p: GPUComputePipeline, threads: number, wg: number) => { pass.setPipeline(p); pass.dispatchWorkgroups(Math.ceil(threads / wg)); };
      for (let s = 0; s < n; s++) {
        run(K.clearGrid, HASH_T, 256);
        run(K.countCells, N, 128);
        run(K.scanBlocks, HASH_T / 4, 256);
        run(K.scanTotals, 64, 64);
        run(K.scanAdd, HASH_T, 256);
        run(K.scatter, N, 128);
        run(K.density, N, 64);
        run(K.forces, N, 64);
        run(K.createSinks, 1, 1);
        run(K.gravity, NB, 256);
        run(K.finalizeStep, 1, 1);
        run(K.integrate, NB, 128);
        run(K.accrete, N, 128);
        run(K.sinkUpdate, SMAX, 64);
      }
      pass.end();
    }

    // ---- asynchronous readback for the readouts (never stalls the GPU) ----
    let frame = 0;
    function scheduleReadback(enc: GPUCommandEncoder) {
      const k = readBusy[0] ? (readBusy[1] ? -1 : 1) : 0;
      if (k < 0) return null;
      enc.copyBufferToBuffer(stBuf, 0, readBuf[k], 0, 64);
      enc.copyBufferToBuffer(bodiesBuf, N * 16, readBuf[k], 64, SMAX * 16);
      readBusy[k] = true;
      return k;
    }
    function harvest(k: number, expectN: number) {
      const b = readBuf[k];
      b.mapAsync(GPUMapMode.READ).then(() => {
        if (expectN === N) {
          const data = b.getMappedRange();
          const u = new Uint32Array(data, 0, 16), f = new Float32Array(data, 0, 16);
          simTime = f[2]; nSinks = u[3]; steps = u[5];
          const sb = new Float32Array(data, 64, SMAX * 4);
          let tot = 0, mx = 0;
          for (let q = 0; q < nSinks; q++) { const m = sb[q * 4 + 3]; tot += m; mx = Math.max(mx, m); }
          starMass = tot; maxStar = mx;
        }
        b.unmap(); readBusy[k] = false;
      }).catch(() => { readBusy[k] = false; });
    }

    // ---- rendering ----
    const cam = new OrbitCamera(stage.canvas, { distance: 3.4, pitch: 0.35, autoRotate: 0.05, minDistance: 0.3, maxDistance: 12 });
    const ru = new Float32Array(64);
    const lut = new Float32Array(64);
    for (let i = 0; i < 16; i++) {
      const lm = -2 + (3.5 * i) / 15; // log10 M/M☉
      const T = Math.min(35000, Math.max(2600, 5800 * Math.pow(10, lm * 0.55)));
      const [r, g, b] = blackbodyRGB(T);
      lut.set([r, g, b, 1], i * 4);
    }
    let bg = [0.012, 0.014, 0.03];
    const setBg = () => { bg = currentTheme() === 'light' ? [0.035, 0.04, 0.075] : [0.012, 0.014, 0.03]; };
    setBg();

    function render(_a: number, frameDt: number) {
      if (cam.update(frameDt || 1 / 60)) { /* auto-rotation */ }
      const W = stage.canvas.width, H = stage.canvas.height;
      if (!hdrTex || hdrTex.width !== W || hdrTex.height !== H) makeHDR();
      const vp = cam.viewProj(W / H);
      ru.set(vp, 0);
      ru.set([1 / Math.tan(cam.fov / 2), W / H, H, 1.2 * stage.dpr], 16);
      ru.set([N, RHO0, h0, 0.05 * Math.cbrt(16384 / N)], 20);
      ru.set([N, M_CLOUD, 1.0, SMAX], 24);
      ru.set([bg[0], bg[1], bg[2], 1.0], 28);
      device.queue.writeBuffer(renUBuf, 0, ru, 0, 32);
      device.queue.writeBuffer(renUBuf, 128, lut);

      const enc = device.createCommandEncoder();
      if (!loop.paused && frameDt > 0) encodeSteps(enc, speed);
      const hp = enc.beginRenderPass({ colorAttachments: [{ view: hdrTex!.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
      hp.setBindGroup(0, renBG);
      hp.setPipeline(gasPipe); hp.draw(6, N);
      hp.setPipeline(starPipe); hp.draw(6, SMAX);
      hp.end();
      const tp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      tp.setBindGroup(0, toneBG); tp.setPipeline(tonePipe); tp.draw(3); tp.end();
      const k = ++frame % 8 === 0 ? scheduleReadback(enc) : null;
      device.queue.submit([enc.finish()]);
      if (k !== null) harvest(k, N);
      updateReadouts();
    }

    // Physics runs inside render() so the number of GPU steps per displayed frame is fixed (speed).
    const loop = new Loop(null, render);
    stage.onResize(() => loop.invalidate());
    cam.onChange = () => loop.invalidate();
    onDestroy(onThemeChange(() => { setBg(); loop.invalidate(); }));

    const clock = document.createElement('div');
    clock.style.cssText = 'position:absolute;left:12px;top:10px;color:#cfd6ea;font-family:var(--font-mono);font-size:0.75rem;line-height:1.5;text-shadow:0 1px 2px #000';
    stage.overlay.append(clock);

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => { loop.paused = p; loop.invalidate(); });
    panel.button('Reset', () => { reset(); loop.invalidate(); }, true);
    panel.select('Particles', Object.keys(COUNTS).map((k) => ({ value: k, label: k })), count, (v) => { count = v; reset(); loop.invalidate(); });
    panel.select('Cloud', [{ value: 'uniform', label: 'Uniform sphere' }, { value: 'be', label: 'Condensed (BE-like)' }], profile, (v) => { profile = v as Profile; reset(); loop.invalidate(); });
    panel.slider('Temperature', { min: 5, max: 40, value: Tgas, step: 1, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => { Tgas = v; writeParams(); jeansRO.set(`${fmt(jeansMassCode(Tgas) * M_CLOUD, 2)} M☉ (${fmt(1 / jeansMassCode(Tgas), 2)} per cloud)`); });
    panel.slider('Turbulence α_vir', { min: 0, max: 2, value: alphaTurb, step: 0.05 }, (v) => { alphaTurb = v; reset(); loop.invalidate(); });
    panel.slider('Rotation β', { min: 0, max: 0.2, value: betaRot, step: 0.005 }, (v) => { betaRot = v; reset(); loop.invalidate(); });
    panel.slider('Speed', { min: 1, max: 6, value: speed, step: 1, format: (v) => `${Math.round(v)} steps/frame` }, (v) => { speed = Math.round(v); });
    const jeansRO = panel.readout('Initial Jeans mass');
    const starsRO = panel.readout('Stars');
    const massRO = panel.readout('Mass in stars');

    function updateReadouts() {
      clock.innerHTML = `t = ${(simTime / T_FF).toFixed(2)} t<sub>ff</sub> &nbsp;(${(simTime * T_UNIT_MYR).toFixed(2)} Myr)<br>${nSinks} star${nSinks === 1 ? '' : 's'} · step ${steps}`;
      starsRO.set(nSinks ? `${nSinks} (largest ${fmt(maxStar * M_CLOUD, 2)} M☉)` : '0');
      massRO.set(`${fmt(starMass * M_CLOUD, 3)} M☉ (${(starMass * 100).toFixed(1)}%)`);
    }

    reset();

    onDestroy(() => {
      bufs.forEach((b) => b.destroy());
      [paramBuf, renUBuf, ...readBuf].forEach((b) => b.destroy());
      hdrTex?.destroy();
    });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
