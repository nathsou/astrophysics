// Chapter 22 flagship: two disk galaxies collide, on the GPU.
//
// Model: live stellar disks (32k–524k particles) + rigid Hernquist bulge and dark halo per galaxy whose
// centres follow a CPU (f64) orbit with Chandrasekhar dynamical friction. A contiguous subset of disk
// particles ("sources") carries the disks' mass; every particle feels the sources through a tiled
// direct-summation compute kernel, plus the analytic potentials. Leapfrog (KDK), Plummer softening.
// Rendering: instanced additive sprites into an rgba16float target, then a tonemapping pass.
// Units: G = 1, 3 kpc, 5×10¹⁰ M☉, 10.96 Myr, 267.7 km/s (see galactic-dynamics/model.ts).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { BASE, scaled, Centers, buildICs, UNIT, type Placement } from './galactic-dynamics/model';
import { NBodyEngine, MAXSUB, type Rigid } from './galactic-dynamics/engine';

type PresetId = 'prograde' | 'retrograde' | 'headon' | 'mwm31';
type Vec3 = [number, number, number];

interface Preset {
  label: string;
  q: number;        // mass ratio of galaxy 1 to galaxy 0
  rp: number;       // pericentre (model units, 3 kpc)
  E: number;        // specific orbital energy
  d0: number;       // initial separation
  n0: Vec3; n1: Vec3;
  cam: number;
}

const norm = (v: Vec3): Vec3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

const PRESETS: Record<PresetId, Preset> = {
  prograde: { label: 'Prograde encounter', q: 1, rp: 5, E: -0.5, d0: 40, n0: [0, 0, 1], n1: norm([0.35, -0.45, 0.82]), cam: 52 },
  retrograde: { label: 'One retrograde disk', q: 1, rp: 5, E: -0.5, d0: 40, n0: [0, 0, -1], n1: norm([0.35, -0.45, 0.82]), cam: 52 },
  headon: { label: 'Head-on (ring galaxy)', q: 0.3, rp: 0.4, E: -0.4, d0: 32, n0: [1, 0, 0], n1: norm([0.2, 0.5, 0.85]), cam: 42 },
  mwm31: { label: 'Milky Way – Andromeda', q: 1.3, rp: 0, E: 0, d0: 260, n0: norm([0.1, 0.4, 0.9]), n1: norm([0.65, -0.35, 0.67]), cam: 70 },
};

const COUNTS = [32768, 131072, 262144, 524288];
const SOURCES: Record<number, number> = { 32768: 8192, 131072: 4096, 262144: 2048, 524288: 1024 };
const EPS = 0.12;      // Plummer softening: 360 pc
const DT = 0.05;       // 0.55 Myr

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1'; // taller on phones
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');
    const eng = new NBodyEngine(device, format);
    onDestroy(() => eng.destroy());

    // ---------------------------------------------------------------- state
    let presetId: PresetId = (params.preset as PresetId) in PRESETS ? (params.preset as PresetId) : 'prograde';
    let N = COUNTS[1];
    let q = PRESETS[presetId].q;
    let rp = PRESETS[presetId].rp;       // model units
    let vtKms = 40;                      // M31 transverse velocity (MW–M31 scenario)
    let stepsPerFrame = 3;
    let colorMode = 0;
    let paused = false;
    let t = 0, tOffset = 0;
    let centers = new Centers([BASE, scaled(q)], 2.5);

    const camera = new OrbitCamera(stage.canvas, { distance: 60, pitch: 0.8, yaw: -1.9, autoRotate: 0.025, near: 0.1, far: 5000, maxDistance: 600, minDistance: 5 });
    camera.onChange = () => loop.invalidate();

    const rigid = (): Rigid => {
      const [g0, g1] = centers.g;
      return { c0: centers.x[0], c1: centers.x[1], h0: [g0.Mh, g0.ah, g0.Mb, g0.ab], h1: [g1.Mh, g1.ah, g1.Mb, g1.ab] };
    };

    function reset() {
      const P = PRESETS[presetId];
      const g0 = BASE, g1 = scaled(q);
      centers = new Centers([g0, g1], 2.5);
      t = 0; tOffset = 0;
      if (presetId === 'mwm31') {
        // Today: 780 kpc apart, closing at 110 km/s; transverse velocity from HST + Gaia proper motions.
        centers.setOrbit(P.d0, 0, 0, -110 / UNIT.kms, vtKms / UNIT.kms);
        // Fast-forward the centres' orbit until the halos are 150 kpc apart, then build the disks there.
        while (centers.separation() > 50 && tOffset < 2000) { centers.step(0.1); tOffset += 0.1; }
      } else centers.setOrbit(P.d0, rp, P.E);

      const n1 = Math.round((N * q) / (1 + q) / 256) * 256, n0 = N - n1;
      const S = SOURCES[N];
      const s0 = Math.round(S / (1 + q)), s1 = S - s0;
      const place = (i: number, n: number, s: number): Placement => ({
        spec: i ? g1 : g0, pos: centers.x[i], vel: centers.v[i], normal: i ? P.n1 : P.n0,
        nDisk: n - Math.round(n * 0.16), nBulge: Math.round(n * 0.16), nSrc: s,
      });
      const ic = buildICs([place(0, n0, s0), place(1, n1, s1)], EPS, true, 12345);
      eng.upload(ic.pos, ic.vel, ic.attr, S, EPS);
      // Prime the accelerations: one force pass with dt = 0.
      eng.setStep(0, 0, rigid());
      const enc = device.createCommandEncoder();
      eng.encode(enc, true);
      device.queue.submit([enc.finish()]);
      camera.distance = P.cam;
      loop.invalidate();
    }

    function advance(steps: number, enc: GPUCommandEncoder) {
      for (let k = 0; k < steps; k++) {
        centers.step(DT);          // f64 leapfrog of the halo centres over the same interval…
        eng.setStep(k, DT, rigid()); // …whose end positions the GPU force pass uses
      }
      eng.encode(enc);
      t += steps * DT;
    }

    // ---------------------------------------------------------------- rendering
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;left:12px;top:10px;font:500 12px/1.5 var(--font-ui,system-ui);color:#cfd6e4;text-shadow:0 1px 2px #000;';
    stage.overlay.append(hud);

    let fpsAvg = 60;
    function render(_a: number, frameDt: number) {
      if (frameDt > 0) fpsAvg += (1 / Math.max(frameDt, 1e-3) - fpsAvg) * 0.05;
      camera.update(frameDt);
      const enc = device.createCommandEncoder();
      if (!paused && frameDt > 0) advance(stepsPerFrame, enc);
      const W = stage.canvas.width, H = stage.canvas.height;
      eng.draw(enc, ctx.getCurrentTexture().createView(), camera.viewProj(W / H), W, H, {
        pointSize: 0.06, minPx: 0.9 * stage.dpr,
        brightness: 0.16 * Math.pow(131072 / N, 0.8) * (stage.dpr > 1.5 ? 1 : 1.6),
        colorMode, speedScale: 1 / 2.4,
      });
      device.queue.submit([enc.finish()]);

      const tMyr = (t + tOffset) * UNIT.Myr;
      const sep = centers.separation() * UNIT.kpc;
      const when = presetId === 'mwm31' ? `${fmt(tMyr / 1000, 3)} Gyr from now` : `t = ${tMyr < 1000 ? `${Math.round(tMyr)} Myr` : `${fmt(tMyr / 1000, 3)} Gyr`}`;
      hud.textContent = `${when} · separation ${sep < 10 ? fmt(sep, 2) : Math.round(sep)} kpc`;
      rN.set(`${N / 1024}k (${eng.nSrc / 1024}k gravitating)`);
      rF.set(`${Math.round(fpsAvg)} fps`);
    }

    // With no fixed-step callback, Loop calls render() every animation frame while visible; the GPU
    // physics substeps are encoded inside render() so physics and drawing share one command buffer.
    const loop = new Loop(null, render);
    stage.onResize(() => { eng.resize(stage.canvas.width, stage.canvas.height); loop.invalidate(); });

    // ---------------------------------------------------------------- controls
    const panel = new Panel(host);
    panel.playPause(() => paused, (p) => { paused = p; });
    panel.button('Reset', () => reset());
    panel.select('Scenario', (Object.keys(PRESETS) as PresetId[]).map((k) => ({ value: k, label: PRESETS[k].label })), presetId, (v) => {
      presetId = v; q = PRESETS[v].q; rp = PRESETS[v].rp;
      qCtl.set(q); syncRp(); reset();
    });
    const qCtl = panel.slider('Mass ratio', { min: 0.1, max: 2, value: q, step: 0.05, format: (v) => `1 : ${fmt(v, 2)}` }, (v) => { q = v; reset(); });
    const rpCtl = panel.slider('Pericentre', {
      min: 0, max: 60, value: rp * UNIT.kpc, step: 1,
      format: (v) => (presetId === 'mwm31' ? `${Math.round(v * 2)} km/s` : `${Math.round(v)} kpc`),
    }, (v) => {
      if (presetId === 'mwm31') vtKms = v * 2; else rp = v / UNIT.kpc;
      reset();
    });
    function syncRp() {
      rpCtl.el.querySelector('label')!.textContent = presetId === 'mwm31' ? 'Transverse v' : 'Pericentre';
      rpCtl.set(presetId === 'mwm31' ? vtKms / 2 : rp * UNIT.kpc);
    }
    panel.slider('Speed', { min: 1, max: MAXSUB, value: stepsPerFrame, step: 1, format: (v) => `${fmt(v * DT * UNIT.Myr * 60, 2)} Myr/s` }, (v) => { stepsPerFrame = Math.round(v); });
    panel.select('Particles', COUNTS.map((c) => ({ value: String(c), label: `${c / 1024}k` })), String(N), (v) => { N = +v; reset(); });
    panel.select('Colour', [{ value: '0', label: 'by galaxy' }, { value: '1', label: 'by population' }, { value: '2', label: 'by speed' }], '0', (v) => { colorMode = +v; loop.invalidate(); });
    const rN = panel.readout('N');
    const rF = panel.readout('');
    syncRp();
    reset();

    // Test hook for headless verification: advance n steps immediately, redraw, resolve when the GPU is done.
    (host as HTMLElement & { __positions?: () => Promise<Float32Array> }).__positions = () => eng.readPositions();
    (host as HTMLElement & { __advance?: (n: number) => Promise<void> }).__advance = (n: number) => {
      for (let done = 0; done < n; done += MAXSUB) {
        const enc = device.createCommandEncoder();
        advance(Math.min(MAXSUB, n - done), enc);
        device.queue.submit([enc.finish()]);
      }
      render(0, 0);
      return device.queue.onSubmittedWorkDone();
    };

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
