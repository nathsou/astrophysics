// Chapter 22: Toomre stability of a razor-thin self-gravitating stellar disk.
// Every particle gravitates (direct summation, same tiled kernel as the merger flagship) inside a
// fixed Hernquist halo + small bulge. The initial radial velocity dispersion is set from the
// Toomre criterion σ_R = 3.36 Q G Σ / κ, so the Q slider directly controls the disk's stability.
// Units as in the merger sim: G = 1, 3 kpc, 5×10¹⁰ M☉, 10.96 Myr.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { buildICs, UNIT, type GalaxySpec } from './galactic-dynamics/model';
import { NBodyEngine, type Rigid } from './galactic-dynamics/engine';

const SPEC: GalaxySpec = { Md: 1, Rd: 1, Mb: 0.08, ab: 0.15, Mh: 2.5, ah: 3 };
const EPS = 0.04;
const DT = 0.01;
const ZERO = [0, 0, 0];

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 4 / 3 });
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');
    const eng = new NBodyEngine(device, format);
    onDestroy(() => eng.destroy());

    let Q = params.Q ? +params.Q : 0.5;
    let N = 16384;
    let t = 0;
    let paused = false;
    const rigid: Rigid = { c0: ZERO, c1: ZERO, h0: [SPEC.Mh, SPEC.ah, SPEC.Mb, SPEC.ab], h1: [0, 1, 0, 1] };

    const camera = new OrbitCamera(stage.canvas, { distance: 13, pitch: 1.35, yaw: -Math.PI / 2, near: 0.05, far: 500, minDistance: 3, maxDistance: 60 });
    camera.onChange = () => loop.invalidate();

    function reset() {
      const ic = buildICs([
        { spec: SPEC, pos: ZERO, vel: ZERO, normal: [0, 0, 1], nDisk: N, nBulge: 0, nSrc: N, Q, flat: true, rMax: 4 },
        { spec: SPEC, pos: ZERO, vel: ZERO, normal: [0, 0, 1], nDisk: 0, nBulge: 0, nSrc: 0 },
      ], EPS, true, 99);
      eng.upload(ic.pos, ic.vel, ic.attr, N, EPS);
      eng.setStep(0, 0, rigid);
      const enc = device.createCommandEncoder();
      eng.encode(enc, true);
      device.queue.submit([enc.finish()]);
      t = 0;
      loop.invalidate();
    }

    // Orbital period at R = 2 R_d, for the time readout.
    const Rref = 2;
    const aRef = SPEC.Mh / (Rref + SPEC.ah) ** 2 + SPEC.Mb / (Rref + SPEC.ab) ** 2 + SPEC.Md * (1 - Math.exp(-Rref) * (1 + Rref)) / (Rref * Rref);
    const Pref = (2 * Math.PI * Rref) / Math.sqrt(aRef * Rref);

    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;left:12px;top:10px;font:500 12px/1.5 var(--font-ui,system-ui);color:#cfd6e4;text-shadow:0 1px 2px #000;';
    stage.overlay.append(hud);

    function render(_a: number, frameDt: number) {
      const enc = device.createCommandEncoder();
      if (!paused && frameDt > 0) {
        for (let k = 0; k < 6; k++) eng.setStep(k, DT, rigid);
        eng.encode(enc);
        t += 6 * DT;
      }
      const W = stage.canvas.width, H = stage.canvas.height;
      eng.draw(enc, ctx.getCurrentTexture().createView(), camera.viewProj(W / H), W, H, {
        pointSize: 0.03, minPx: 0.9 * stage.dpr, brightness: 0.55 * (16384 / N) * (stage.dpr > 1.5 ? 1 : 1.5),
        colorMode: 1, speedScale: 0.5,
      });
      device.queue.submit([enc.finish()]);
      hud.textContent = `Q = ${fmt(Q, 2)} · t = ${Math.round(t * UNIT.Myr)} Myr ≈ ${fmt(t / Pref, 2)} rotations at 6 kpc`;
    }

    const loop = new Loop(null, render);
    stage.onResize(() => { eng.resize(stage.canvas.width, stage.canvas.height); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => paused, (p) => { paused = p; });
    panel.button('Reset', reset);
    const qs = panel.slider('Toomre Q', { min: 0.2, max: 2.5, value: Q, step: 0.05, format: (v) => fmt(v, 2) }, (v) => { Q = v; reset(); });
    panel.button('Cold (Q = 0.4)', () => { Q = 0.4; qs.set(Q); reset(); });
    panel.button('Marginal (Q = 1.2)', () => { Q = 1.2; qs.set(Q); reset(); });
    panel.button('Hot (Q = 2.2)', () => { Q = 2.2; qs.set(Q); reset(); });
    panel.select('Particles', [{ value: '8192', label: '8k' }, { value: '16384', label: '16k' }, { value: '32768', label: '32k' }], String(N), (v) => { N = +v; reset(); });
    reset();

    (host as HTMLElement & { __positions?: () => Promise<Float32Array> }).__positions = () => eng.readPositions();
    (host as HTMLElement & { __advance?: (n: number) => Promise<void> }).__advance = (n: number) => {
      for (let done = 0; done < n; done += 8) {
        const enc = device.createCommandEncoder();
        const k = Math.min(8, n - done);
        for (let j = 0; j < k; j++) eng.setStep(j, DT, rigid);
        eng.encode(enc);
        device.queue.submit([enc.finish()]);
        t += k * DT;
      }
      render(0, 0);
      return device.queue.onSubmittedWorkDone();
    };

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
