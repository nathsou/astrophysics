// Chapter 1 flagship: a continuous "Powers of Ten" zoom from Earth (10⁷ m) to the observable
// universe (10²⁷ m) in WebGPU, with f32 everywhere on the GPU.
//
// Precision scheme (see the <Hood> in scales.mdx):
//  • every scale regime is a *layer* with its own natural unit (R⊕, AU, pc, kpc, Mpc) and origin;
//  • the camera orbits a *focus* point at distance D = 10^z m; the CPU computes, in f64,
//    offset = (layer origin − focus) / unit and scale = unit / D, so the GPU only ever sees
//    O(1) numbers in "units of D" (camera-relative rendering / floating origin);
//  • depth is logarithmic, so one depth buffer spans 10⁻⁵ D … 10¹⁵ D;
//  • everything is drawn additively into an rgba16float target and tonemapped at the end.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { lookAt, perspective } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import commonWGSL from './scales/common.wgsl?raw';
import pointsWGSL from './scales/points.wgsl?raw';
import spheresWGSL from './scales/spheres.wgsl?raw';
import tonemapWGSL from './scales/tonemap.wgsl?raw';
import {
  AU, PC, KPC, MPC, LY, R_EARTH, R_SUN_GC, R_CMB, IDENT, GAL2ECL, EARTH_AU, MOON_POS, VOYAGER1_AU, JADES_MPC,
  STARS, LOCAL, CLUSTERS, planets, apply3, starPos, galPosMpc, clusterPos,
  orbitLines, moonOrbit, solarPoints, oortPoints, starPoints, milkyWay, localGroup, cosmicWeb,
  type M3, type Points,
} from './scales/zoom-data';

const Z_MIN = 6.9, Z_MAX = 27.4;
const FOV = (50 * Math.PI) / 180;
const FAR = 1e15;

type Knots = [number, number][];
/** Piecewise-smoothstep interpolation of (z, value) knots: the crossfade schedule of a layer. */
function knot(z: number, k: Knots) {
  if (z <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (z <= k[i][0]) {
      const t = (z - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * t * t * (3 - 2 * t);
    }
  }
  return k[k.length - 1][1];
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// World frame: ecliptic J2000 axes, origin at the Sun, metres (f64).
const EARTH = EARTH_AU.map((v) => v * AU);
const GC = apply3(GAL2ECL, [R_SUN_GC * KPC, 0, 0]);
const M31 = apply3(GAL2ECL, galPosMpc(LOCAL[0])).map((v) => v * MPC);
const LG_BARY = M31.map((v, i) => 0.4 * v + 0.6 * GC[i]);

/** The point the camera orbits, as a function of zoom: Earth → Sun → Galactic centre → Local Group → us. */
function focusAt(z: number): number[] {
  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  let f = lerp(EARTH, [0, 0, 0], smooth(10.2, 11.2, z));
  f = lerp(f, GC, smooth(19.6, 20.7, z));
  f = lerp(f, LG_BARY, smooth(22.0, 22.9, z));
  f = lerp(f, [0, 0, 0], smooth(23.6, 24.6, z));
  return f;
}

const REGIMES: [number, string, string][] = [
  [9.0, 'Earth & Moon', 'Light takes 1.3 s to cross from the Moon. Everything humans have ever walked on is in this frame.'],
  [12.2, 'The inner Solar System', '1 AU = 1.496 × 10¹¹ m, light-time 8.3 minutes. The rocky planets huddle within 1.5 AU.'],
  [14.2, 'The planets & the Kuiper belt', 'Neptune is at 30 AU; Voyager 1, our farthest probe, is at ~169 AU (a light-day is 173 AU).'],
  [16.3, 'The Oort cloud', 'A trillion icy bodies out to ~10⁵ AU, 1.5 light-years: the Sun’s gravitational reach.'],
  [19.3, 'The solar neighbourhood', 'The nearest star is 1.3 pc away. The brightest naked-eye stars are within ~1 kpc.'],
  [21.9, 'The Milky Way', '~10¹¹ stars in a barred spiral ~30 kpc across. The Sun orbits 8.2 kpc out, once every ~230 Myr.'],
  [23.4, 'The Local Group', 'Andromeda, 0.77 Mpc away, is falling towards us at 110 km/s. Merger in ~5 Gyr.'],
  [25.6, 'Clusters & superclusters', 'Galaxies trace filaments around empty voids tens of Mpc across.'],
  [26.4, 'The cosmic web', 'Structure on every scale up to ~100 Mpc; beyond that the universe looks statistically uniform.'],
  [99, 'The observable universe', 'We see out to the last-scattering surface, 13.9 Gpc (≈ 45 billion light-years) away today.'],
];

interface Label { text: string; world: () => number[]; z0: number; z1: number; big?: boolean; el?: HTMLDivElement }

function niceScale(pxPerM: number, targetPx: number): { px: number; text: string } {
  const L = targetPx / pxPerM;
  const units: [number, string][] = [[1, 'm'], [1e3, 'km'], [AU, 'AU'], [LY, 'ly'], [PC, 'pc'], [KPC, 'kpc'], [MPC, 'Mpc'], [1e3 * MPC, 'Gpc']];
  let u = units[0];
  for (const cand of units) if (L >= cand[0] * 0.8) u = cand;
  if (u[1] === 'km' && L > 3e8) u = units[1];
  const v = L / u[0];
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const nice = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  return { px: nice * u[0] * pxPerM, text: `${fmt(nice, 3)} ${u[1]}` };
}

function lightTime(m: number): string {
  const s = m / 2.99792458e8;
  if (s < 60) return `${fmt(s, 2)} s`;
  if (s < 3600) return `${fmt(s / 60, 2)} min`;
  if (s < 86400 * 2) return `${fmt(s / 3600, 2)} h`;
  const y = s / 3.15576e7;
  if (y < 1) return `${fmt(s / 86400, 2)} days`;
  if (y < 1e3) return `${fmt(y, 2)} yr`;
  if (y < 1e6) return `${fmt(y / 1e3, 2)} kyr`;
  if (y < 1e9) return `${fmt(y / 1e6, 2)} Myr`;
  return `${fmt(y / 1e9, 2)} Gyr`;
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const narrow = host.getBoundingClientRect().width < 640;
    const stage = createStage(host, { aspect: narrow ? 1 : 16 / 9 });
    stage.el.style.background = '#02030a';
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    // ---------------------------------------------------------------- pipelines
    const mod = (code: string) => {
      const m = device.createShaderModule({ code });
      if (import.meta.env.DEV) m.getCompilationInfo().then((i) => i.messages.forEach((x) => console.warn('[scales-zoom WGSL]', x.lineNum, x.message)));
      return m;
    };
    const pointMod = mod(commonWGSL + pointsWGSL);
    const sphereMod = mod(commonWGSL + spheresWGSL);
    const toneMod = mod(tonemapWGSL);
    const HDR: GPUTextureFormat = 'rgba16float';
    const add: GPUBlendState = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    const absorb: GPUBlendState = { color: { srcFactor: 'zero', dstFactor: 'one-minus-src' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };

    const V = GPUShaderStage.VERTEX, FR = GPUShaderStage.FRAGMENT;
    const layerBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: V | FR, buffer: { type: 'uniform' } },
      { binding: 1, visibility: V | FR, buffer: { type: 'uniform' } },
      { binding: 2, visibility: V, buffer: { type: 'read-only-storage' } },
    ] });
    const sphereBGL = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: V | FR, buffer: { type: 'uniform' } },
      { binding: 1, visibility: V | FR, buffer: { type: 'uniform' } },
    ] });
    const layerPL = device.createPipelineLayout({ bindGroupLayouts: [layerBGL] });
    const spherePL = device.createPipelineLayout({ bindGroupLayouts: [sphereBGL] });
    const depthRO: GPUDepthStencilState = { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less' };
    const mkLayerPipe = (vs: string, fs: string, blend: GPUBlendState, topology: GPUPrimitiveTopology) =>
      device.createRenderPipeline({
        layout: layerPL,
        vertex: { module: pointMod, entryPoint: vs },
        fragment: { module: pointMod, entryPoint: fs, targets: [{ format: HDR, blend }] },
        primitive: { topology },
        depthStencil: depthRO,
      });
    const pointPipe = mkLayerPipe('vsPoint', 'fsPoint', add, 'triangle-strip');
    const dustPipe = mkLayerPipe('vsPoint', 'fsDust', absorb, 'triangle-strip');
    const linePipe = mkLayerPipe('vsLine', 'fsLine', add, 'line-list');
    const mkSpherePipe = (write: boolean) => device.createRenderPipeline({
      layout: spherePL,
      vertex: { module: sphereMod, entryPoint: 'vs' },
      fragment: { module: sphereMod, entryPoint: 'fs', targets: [{ format: HDR, blend: add }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: write, depthCompare: write ? 'less-equal' : 'always' },
    });
    const spherePipe = mkSpherePipe(true);
    const cmbPipe = mkSpherePipe(false);
    const tonePipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: toneMod, entryPoint: 'vs' },
      fragment: { module: toneMod, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const buffers: GPUBuffer[] = [];
    const ubuf = (size: number) => { const b = device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); buffers.push(b); return b; };
    const frameBuf = ubuf(160);
    const toneBuf = ubuf(16);

    // ---------------------------------------------------------------- layers
    type Kind = 'points' | 'dust' | 'lines';
    interface Layer {
      name: string; kind: Kind; unit: number; rot: M3; origin: number[]; fade: Knots;
      gain: number; minPx: number; worldR: number; maxPx: number;
      ub: GPUBuffer; sb?: GPUBuffer; bg?: GPUBindGroup; count: number;
    }
    const layers: Layer[] = [];
    const mkLayer = (o: Omit<Layer, 'ub' | 'count'>) => { const L: Layer = { ...o, ub: ubuf(80), count: 0 }; layers.push(L); return L; };
    const upload = (L: Layer, p: Points) => {
      L.sb?.destroy();
      const data = p.view();
      L.sb = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(L.sb, 0, data);
      L.count = p.n;
      L.bg = device.createBindGroup({ layout: layerBGL, entries: [
        { binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: { buffer: L.ub } }, { binding: 2, resource: { buffer: L.sb } },
      ] });
    };

    // Draw order matters for the dust (absorbs what is already drawn) and for depth (spheres first).
    const web = mkLayer({ name: 'web', kind: 'points', unit: MPC, rot: GAL2ECL, origin: [0, 0, 0], fade: [[23.3, 0], [24.2, 1], [30, 1]], gain: 1.1, minPx: 1.0, worldR: 0.6, maxPx: 40 });
    const lg = mkLayer({ name: 'lg', kind: 'points', unit: MPC, rot: GAL2ECL, origin: [0, 0, 0], fade: [[21.4, 0], [22.2, 1], [24.1, 1], [25.0, 0]], gain: 0.9, minPx: 0.9, worldR: 0.0012, maxPx: 50 });
    const mw = mkLayer({ name: 'mw', kind: 'points', unit: KPC, rot: GAL2ECL, origin: GC, fade: [[0, 0.3], [18.2, 0.3], [19.8, 1], [23.2, 1], [24.3, 0]], gain: 0.8, minPx: 0.9, worldR: 0.1, maxPx: 60 });
    const dust = mkLayer({ name: 'dust', kind: 'dust', unit: KPC, rot: GAL2ECL, origin: GC, fade: [[0, 0.5], [18.5, 0.5], [19.8, 1], [22.4, 1], [23.2, 0]], gain: 0.22, minPx: 1.5, worldR: 0.28, maxPx: 70 });
    const stars = mkLayer({ name: 'stars', kind: 'points', unit: PC, rot: IDENT, origin: [0, 0, 0], fade: [[0, 1], [19.3, 1], [20.3, 0]], gain: 1.1, minPx: 1.1, worldR: 0, maxPx: 50 });
    const oort = mkLayer({ name: 'oort', kind: 'points', unit: AU, rot: IDENT, origin: [0, 0, 0], fade: [[13.6, 0], [14.8, 1], [16.8, 1], [17.7, 0]], gain: 0.7, minPx: 1.0, worldR: 0, maxPx: 50 });
    const solar = mkLayer({ name: 'solar', kind: 'points', unit: AU, rot: IDENT, origin: [0, 0, 0], fade: [[10.0, 0], [10.8, 1], [14.0, 1], [15.0, 0]], gain: 1.0, minPx: 1.3, worldR: 0, maxPx: 50 });
    const orbits = mkLayer({ name: 'orbits', kind: 'lines', unit: AU, rot: IDENT, origin: [0, 0, 0], fade: [[9.3, 0], [10.2, 1], [14.0, 1], [15.2, 0]], gain: 0.5, minPx: 1, worldR: 0, maxPx: 1 });
    const moonL = mkLayer({ name: 'moon-orbit', kind: 'lines', unit: R_EARTH, rot: IDENT, origin: EARTH, fade: [[7.9, 0], [8.6, 1], [9.6, 1], [10.4, 0]], gain: 0.5, minPx: 1, worldR: 0, maxPx: 1 });

    const QUALITY: Record<string, [number, number]> = { low: [32768, 90000], medium: [131072, 300000], high: [524288, 700000] };
    let quality = (params.quality as string) in QUALITY ? (params.quality as string) : narrow ? 'low' : 'medium';
    function build() {
      const [nMW, nWeb] = QUALITY[quality];
      const g = milkyWay(nMW);
      upload(mw, g.pts);
      upload(dust, g.dust);
      upload(web, cosmicWeb(nWeb));
    }
    build();
    upload(lg, localGroup(Math.round(QUALITY[quality][0] * 0.4)));
    upload(stars, starPoints(30000));
    upload(oort, oortPoints(30000));
    upload(solar, solarPoints());
    upload(orbits, orbitLines());
    upload(moonL, moonOrbit());

    // ---------------------------------------------------------------- spheres
    interface Sph { kind: number; world: () => number[]; radius: number; fade: Knots; glowPx: number; halo: number; ub: GPUBuffer; bg: GPUBindGroup }
    const spheres: Sph[] = [];
    const mkSphere = (kind: number, world: () => number[], radius: number, fade: Knots, glowPx: number, halo: number, pipe: GPURenderPipeline) => {
      const ub = ubuf(80);
      const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: { buffer: ub } }] });
      const s: Sph = { kind, world, radius, fade, glowPx, halo, ub, bg };
      spheres.push(s);
      return s;
    };
    const MOON = EARTH.map((v, i) => v + MOON_POS[i] * R_EARTH);
    const sEarth = mkSphere(0, () => EARTH, R_EARTH, [[0, 1], [10.6, 1], [11.4, 0]], 1.3, 1.6, spherePipe);
    const sMoon = mkSphere(1, () => MOON, 1.7374e6, [[0, 1], [10.0, 1], [10.8, 0]], 1.0, 1.6, spherePipe);
    const sSun = mkSphere(2, () => [0, 0, 0], 6.957e8, [[0, 1], [17.5, 1], [19.0, 0]], 2.2, 60, spherePipe);
    const sCMB = mkSphere(3, () => [0, 0, 0], R_CMB, [[25.8, 0], [26.7, 1], [30, 1]], 1, 1.05, cmbPipe);

    // ---------------------------------------------------------------- render targets
    let hdrTex: GPUTexture | null = null, depthTex: GPUTexture | null = null, toneBG: GPUBindGroup | null = null;
    function targets() {
      hdrTex?.destroy(); depthTex?.destroy();
      const size = [stage.canvas.width, stage.canvas.height];
      hdrTex = device.createTexture({ size, format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      depthTex = device.createTexture({ size, format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
      toneBG = device.createBindGroup({ layout: tonePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: hdrTex.createView() }, { binding: 1, resource: { buffer: toneBuf } }] });
    }

    // ---------------------------------------------------------------- overlay: labels, title, scale bar
    const ov = stage.overlay;
    ov.style.color = 'rgba(225,232,255,0.9)';
    ov.style.overflow = 'hidden';
    const title = document.createElement('div');
    title.style.cssText = `position:absolute;left:14px;top:12px;max-width:${narrow ? '47%' : 'min(26rem,70%)'};text-shadow:0 1px 3px #000;transition:opacity .4s`;
    const tH = document.createElement('div');
    tH.style.cssText = 'font-size:1.05rem;font-weight:600;letter-spacing:.01em;color:#fff';
    const tP = document.createElement('div');
    tP.style.cssText = 'font-size:.72rem;line-height:1.35;margin-top:3px;color:rgba(220,228,255,.78)';
    title.append(tH, tP);
    const zBig = document.createElement('div');
    zBig.style.cssText = `position:absolute;right:14px;top:10px;text-align:right;${narrow ? 'max-width:40%;' : ''}font-family:var(--font-mono);color:#fff;text-shadow:0 1px 3px #000`;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;left:14px;bottom:14px;font-family:var(--font-mono);font-size:.7rem;color:#fff;text-shadow:0 1px 2px #000';
    const barLine = document.createElement('div');
    barLine.style.cssText = 'height:6px;border:1.5px solid rgba(255,255,255,.85);border-top:none;margin-top:3px';
    const barText = document.createElement('div');
    bar.append(barText, barLine);
    const hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;right:14px;bottom:14px;font-size:.68rem;color:rgba(220,228,255,.6);transition:opacity 1s';
    hint.textContent = 'scroll / pinch to zoom · drag to rotate';
    ov.append(title, zBig, bar, hint);

    const labels: Label[] = [];
    const lab = (text: string, world: () => number[], z0: number, z1: number, big = false) => labels.push({ text, world, z0, z1, big });
    lab('Earth', () => EARTH, 6.5, 11.2, true);
    lab('Moon', () => MOON, 7.2, 10.2);
    lab('Sun', () => [0, 0, 0], 9.6, 18.3, true);
    for (const p of planets) {
      const d = p.a * AU, lz = Math.log10(d);
      if (p.name === 'Earth') { lab('Earth', () => EARTH, 11.2, lz + 2.3); continue; }
      lab(p.name, () => p.pos.map((v) => v * AU), lz - 0.15, lz + 2.3);
    }
    lab('Voyager 1', () => VOYAGER1_AU.map((v) => v * AU), 12.9, 15.3);
    lab('Asteroid belt', () => [2.75 * AU * Math.cos(4), 2.75 * AU * Math.sin(4), 0], 11.5, 12.8);
    lab('Kuiper belt', () => [44 * AU * Math.cos(2.5), 44 * AU * Math.sin(2.5), 0], 12.9, 14.3);
    lab('Oort cloud', () => [3e4 * AU * 0.6, 3e4 * AU * -0.7, 3e4 * AU * 0.3], 15.3, 17.3, true);
    for (const s of STARS) if (s[6]) { const lz = Math.log10(s[3] * PC); lab(s[0], () => starPos(s).map((v) => v * PC), lz - 0.4, Math.min(20.2, lz + 1.7)); }
    lab('Sun — you are here', () => [0, 0, 0], 19.4, 22.3, true);
    lab('Sgr A* (galactic centre)', () => GC, 19.9, 22.2);
    lab('Milky Way', () => GC, 22.2, 24.3, true);
    for (const g of LOCAL) if (g[7]) { const lz = Math.log10(g[3] * MPC); lab(g[0], () => apply3(GAL2ECL, galPosMpc(g)).map((v) => v * MPC), lz - 0.3, lz + 1.5, g[0].startsWith('Andromeda')); }
    for (const c of CLUSTERS) { const lz = Math.log10(c[3] * MPC); lab(c[0], () => apply3(GAL2ECL, clusterPos(c)).map((v) => v * MPC), lz - 0.25, lz + 1.4); }
    lab('Laniakea supercluster', () => apply3(GAL2ECL, [30, -40, 5]).map((v) => v * MPC), 24.6, 25.8, true);
    lab('JADES-GS-z14-0 (seen 290 Myr after the Big Bang)', () => apply3(GAL2ECL, JADES_MPC).map((v) => v * MPC), 25.9, 27.4);
    lab('Cosmic microwave background (last scattering, z ≈ 1100)', () => [R_CMB * 0.62, R_CMB * -0.62, R_CMB * 0.48], 26.4, 28, true);
    lab('you are here', () => [0, 0, 0], 25.2, 28);
    for (const L of labels) {
      const el = document.createElement('div');
      el.textContent = L.text;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font-size:${L.big ? '.78rem' : '.68rem'};${L.big ? 'font-weight:600;color:#fff;' : ''}text-shadow:0 0 3px #000,0 1px 2px #000;will-change:transform,opacity;opacity:0`;
      const dot = document.createElement('span');
      dot.style.cssText = 'display:inline-block;width:4px;height:4px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:middle;opacity:.8';
      el.prepend(dot);
      ov.append(el);
      L.el = el;
    }

    // ---------------------------------------------------------------- camera state & input
    let z = params.z ? +params.z : 7.35, zTarget = z;
    let yaw = -0.9, pitch = 0.42;
    let tour = false, lastInput = -1e9, time = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const cv = stage.canvas;
    cv.style.touchAction = 'none';
    cv.style.cursor = 'grab';
    const touched = () => { lastInput = performance.now(); hint.style.opacity = '0'; loop.invalidate(); };
    const setZ = (v: number) => { zTarget = Math.max(Z_MIN, Math.min(Z_MAX, v)); };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (pointers.size === 1) {
        yaw -= (e.clientX - p.x) * 0.005;
        pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - p.y) * 0.005));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) { setZ(zTarget + Math.log10(pinch / d) * 2); tour = false; syncTour(); }
        pinch = d;
      }
      touched();
    });
    const up = (e: PointerEvent) => { pointers.delete(e.pointerId); pinch = 0; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      setZ(zTarget + dy * 0.0025);
      tour = false; syncTour();
      touched();
    }, { passive: false });

    // ---------------------------------------------------------------- per-frame uniforms
    const frameData = new Float32Array(40);
    const layerData = new Float32Array(20);
    const sphereData = new Float32Array(20);
    const toneData = new Float32Array([1, 1, 0, 0]);
    const proj = new Float32Array(16);
    const view = new Float32Array(16);

    const viewRot = (v: number[]) => [
      view[0] * v[0] + view[4] * v[1] + view[8] * v[2],
      view[1] * v[0] + view[5] * v[1] + view[9] * v[2],
      view[2] * v[0] + view[6] * v[1] + view[10] * v[2],
    ];

    function frame(dt: number) {
      time += dt;
      if (tour) {
        setZ(zTarget + dt * 0.55);
        if (zTarget >= Z_MAX) { tour = false; syncTour(); }
      }
      z += (zTarget - z) * (1 - Math.exp(-dt * 5));
      if (Math.abs(zTarget - z) < 1e-4) z = zTarget;
      if (performance.now() - lastInput > 4000) yaw += dt * 0.025;
      if (slider.get() !== +z.toFixed(2)) slider.set(+z.toFixed(2));

      const D = Math.pow(10, z);
      const focus = focusAt(z);
      const W = stage.canvas.width, H = stage.canvas.height, dpr = stage.dpr;
      const aspect = W / H;
      const eye = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)];
      lookAt(eye, [0, 0, 0], [0, 0, 1], view);
      perspective(FOV, aspect, 1e-5, FAR, proj);
      const tanY = Math.tan(FOV / 2);
      const focalPx = H / 2 / tanY;
      frameData.set(view, 0);
      frameData.set(proj, 16);
      frameData.set([W, H, focalPx, 1 / Math.log2(1 + FAR), tanY * aspect, tanY, time, 0], 32);
      device.queue.writeBuffer(frameBuf, 0, frameData);

      // Layers: offset and scale computed in f64 here, then rounded to f32 — the floating origin.
      for (const L of layers) {
        const a = knot(z, L.fade);
        const r = L.rot;
        layerData.set([r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0]);
        layerData[12] = (L.origin[0] - focus[0]) / L.unit;
        layerData[13] = (L.origin[1] - focus[1]) / L.unit;
        layerData[14] = (L.origin[2] - focus[2]) / L.unit;
        layerData[15] = L.unit / D;
        layerData[16] = a * L.gain;
        layerData[17] = L.minPx * dpr;
        layerData[18] = L.worldR;
        layerData[19] = L.maxPx * dpr;
        device.queue.writeBuffer(L.ub, 0, layerData);
      }
      // Spheres: centre and radius in view space, units of D.
      const tilt = (23.44 * Math.PI) / 180, spin = time * 0.05;
      const earthRot: M3 = (() => {
        const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
        return [cs, -sn, 0, sn * ct, cs * ct, -st, sn * st, cs * st, ct];
      })();
      for (const s of spheres) {
        const w = s.world();
        const rel = [(w[0] - focus[0]) / D, (w[1] - focus[1]) / D, (w[2] - focus[2]) / D];
        const c = viewRot(rel);
        c[0] += view[12]; c[1] += view[13]; c[2] += view[14];
        const r = s.radius / D;
        const dist = Math.hypot(c[0], c[1], c[2]);
        const depth = Math.max(-c[2], 1e-12);
        const k = dist > r * 1.02 ? 1.6 / Math.sqrt(Math.max(1e-6, 1 - (r / dist) ** 2)) : 0;
        const half = k === 0 ? 0 : Math.max(r * k * s.halo, (s.glowPx * 8 + 2) * dpr * depth / focalPx);
        const m = s.kind === 0 ? earthRot : IDENT;
        const col = (j: number) => viewRot([m[j], m[3 + j], m[6 + j]]);
        const c0 = col(0), c1 = col(1), c2 = col(2);
        const sd = viewRot(EARTH.map((v) => -v / AU));
        const sl = Math.hypot(sd[0], sd[1], sd[2]);
        sphereData.set([c[0], c[1], c[2], r, c0[0], c0[1], c0[2], s.kind, c1[0], c1[1], c1[2], knot(z, s.fade), c2[0], c2[1], c2[2], half, sd[0] / sl, sd[1] / sl, sd[2] / sl, s.glowPx * dpr]);
        device.queue.writeBuffer(s.ub, 0, sphereData);
      }
      toneData[0] = 1.0;
      device.queue.writeBuffer(toneBuf, 0, toneData);

      // ---- draw
      if (!hdrTex || hdrTex.width !== W || hdrTex.height !== H) targets();
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: hdrTex!.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
        depthStencilAttachment: { view: depthTex!.createView(), depthLoadOp: 'clear', depthStoreOp: 'discard', depthClearValue: 1 },
      });
      pass.setPipeline(spherePipe);
      for (const s of [sEarth, sMoon, sSun]) if (knot(z, s.fade) > 0.002) { pass.setBindGroup(0, s.bg); pass.draw(6); }
      if (knot(z, sCMB.fade) > 0.002) { pass.setPipeline(cmbPipe); pass.setBindGroup(0, sCMB.bg); pass.draw(6); }
      for (const L of layers) {
        if (knot(z, L.fade) <= 0.002 || !L.count) continue;
        if (L.kind === 'lines') { pass.setPipeline(linePipe); pass.setBindGroup(0, L.bg!); pass.draw(L.count); }
        else { pass.setPipeline(L.kind === 'dust' ? dustPipe : pointPipe); pass.setBindGroup(0, L.bg!); pass.draw(4, L.count); }
      }
      pass.end();
      const tp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      tp.setPipeline(tonePipe);
      tp.setBindGroup(0, toneBG!);
      tp.draw(3);
      tp.end();
      device.queue.submit([enc.finish()]);

      // ---- overlay (CSS px)
      const Wc = stage.width, Hc = stage.height;
      const reg = REGIMES.find((r) => z < r[0])!;
      if (tH.textContent !== reg[1]) { tH.textContent = reg[1]; tP.textContent = reg[2]; }
      zBig.innerHTML = `<div style="font-size:1.1rem">10<sup>${z.toFixed(1)}</sup> m</div><div style="font-size:.66rem;opacity:.75">light crosses the view in ${lightTime(D * 2 * tanY * aspect)}</div>`;
      const sb = niceScale(Hc / 2 / tanY / D, Math.min(140, Wc * 0.25));
      barText.textContent = sb.text;
      barLine.style.width = `${sb.px.toFixed(1)}px`;
      for (const L of labels) {
        const a = Math.min(smooth(L.z0, L.z0 + 0.35, z), 1 - smooth(L.z1 - 0.35, L.z1, z));
        if (a <= 0.01) { if (L.el!.style.opacity !== '0') L.el!.style.opacity = '0'; continue; }
        const w = L.world();
        const v = viewRot([(w[0] - focus[0]) / D, (w[1] - focus[1]) / D, (w[2] - focus[2]) / D]);
        v[0] += view[12]; v[1] += view[13]; v[2] += view[14];
        if (-v[2] <= 1e-9) { L.el!.style.opacity = '0'; continue; }
        const x = (v[0] / (-v[2] * tanY * aspect) * 0.5 + 0.5) * Wc;
        const y = (0.5 - v[1] / (-v[2] * tanY) * 0.5) * Hc;
        if (x < -50 || x > Wc + 10 || y < 0 || y > Hc) { L.el!.style.opacity = '0'; continue; }
        L.el!.style.opacity = a.toFixed(2);
        L.el!.style.transform = `translate(${(x - 2).toFixed(1)}px,${(y - 7).toFixed(1)}px)`;
      }
    }

    const loop = new Loop(null, (_a, dt) => frame(dt || 1 / 60));
    stage.onResize(() => loop.invalidate());

    // ---------------------------------------------------------------- controls
    const panel = new Panel(host);
    const tourBtn = panel.button('▶ Tour', () => { tour = !tour; if (tour && zTarget > Z_MAX - 0.1) { z = zTarget = 7.35; } syncTour(); touched(); }, true);
    function syncTour() { tourBtn.textContent = tour ? '❚❚ Pause tour' : '▶ Tour'; }
    const slider = panel.slider('Scale', { min: Z_MIN, max: Z_MAX, value: z, step: 0.01, format: (v) => `10^${v.toFixed(1)} m` }, (v) => { setZ(v); z = v; tour = false; syncTour(); touched(); });
    const PRESETS: [string, number][] = [['Earth', 7.35], ['Earth–Moon', 9.0], ['Inner planets', 11.6], ['Outer planets', 13.0], ['Oort cloud', 16.0], ['Nearest stars', 17.4], ['Bright stars', 18.9], ['Milky Way', 21.0], ['Local Group', 22.9], ['Virgo & Laniakea', 24.7], ['Cosmic web', 25.9], ['Observable universe', 27.1]];
    panel.select('Jump to', [{ value: '', label: '—' }, ...PRESETS.map(([l, v]) => ({ value: String(v), label: l }))], '', (v) => { if (v) { setZ(+v); tour = false; syncTour(); touched(); } });
    panel.select('Particles', [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }], quality as 'low', (v) => { quality = v; build(); loop.invalidate(); });

    onDestroy(() => { buffers.forEach((b) => b.destroy()); layers.forEach((L) => L.sb?.destroy()); hdrTex?.destroy(); depthTex?.destroy(); });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
