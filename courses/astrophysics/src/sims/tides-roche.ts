// Chapter 9 flagship: a self-gravitating rubble pile orbiting close to a planet.
// A few thousand grains feel the planet's *exact* gravity plus their own mutual gravity
// (softened, with soft-sphere contacts). Outside the Roche limit the pile's self-gravity wins and
// it stays together; inside, the planet's differential pull wins and it stretches into a
// "string of pearls" and smears into a ring. Grains that hit the planet are absorbed.
// All physics runs on the GPU: direct O(N²) forces, KDK leapfrog, one command buffer per frame.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import shader from './tides/roche.wgsl?raw';

type Quality = 'low' | 'med' | 'high';
const QUALITY: Record<Quality, { n: number; label: string }> = {
  low: { n: 1024, label: 'Low (1024)' },
  med: { n: 2048, label: 'Medium (2048)' },
  high: { n: 3584, label: 'High (3584)' },
};

const GMp = 1; // planet GM, in natural units
const Rp = 1; // planet radius
const Rm0 = 0.3; // rubble-pile radius, in units of Rp (large, so the pile is easy to see)
const rhoM = 3 / (4 * Math.PI); // planet bulk density in these units (M_p = 1, R_p = 1)

function rocheLimits(densityRatio: number) {
  const cube = Math.cbrt(densityRatio);
  return { fluid: 2.44 * Rp * cube, rigid: 1.26 * Rp * cube };
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    stage.el.style.background = '#000';
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    const module = device.createShaderModule({ code: shader, label: 'tides-roche' });
    if (import.meta.env.DEV) {
      module.getCompilationInfo().then((info) => {
        for (const m of info.messages) console[m.type === 'error' ? 'error' : 'warn'](`[tides-roche] ${m.lineNum}:${m.linePos} ${m.message}`);
      });
    }

    // Explicit shared bind-group layout: 'auto' layouts differ per entry point (e.g. csDrift
    // never touches `accel`), which would make the four-binding bind groups below invalid for it.
    const computeBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });
    const computeLayout = device.createPipelineLayout({ bindGroupLayouts: [computeBGL] });
    const accelPipeline = device.createComputePipeline({ layout: computeLayout, compute: { module, entryPoint: 'csAccel' } });
    const kickPipeline = device.createComputePipeline({ layout: computeLayout, compute: { module, entryPoint: 'csKick' } });
    const driftPipeline = device.createComputePipeline({ layout: computeLayout, compute: { module, entryPoint: 'csDrift' } });
    const over: GPUBlendState = {
      color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    };
    const bgPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsBg' },
      fragment: { module, entryPoint: 'fsBg', targets: [{ format, blend: over }] },
      primitive: { topology: 'triangle-list' },
    });
    const ptsPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsPts' },
      fragment: { module, entryPoint: 'fsPts', targets: [{ format, blend: over }] },
      primitive: { topology: 'triangle-list' },
    });

    const NMAX = QUALITY.high.n;
    const bufA = device.createBuffer({ size: NMAX * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const bufB = device.createBuffer({ size: NMAX * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const accelBuf = device.createBuffer({ size: NMAX * 8, usage: GPUBufferUsage.STORAGE });
    const paramsBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const SAMPLES = 64;
    const readBuf = device.createBuffer({ size: SAMPLES * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    onDestroy(() => { bufA.destroy(); bufB.destroy(); accelBuf.destroy(); paramsBuf.destroy(); readBuf.destroy(); });

    const bg = (buf: GPUBuffer) => (pipe: GPUComputePipeline) =>
      device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: buf } },
          { binding: 1, resource: { buffer: buf === bufA ? bufB : bufA } },
          { binding: 2, resource: { buffer: accelBuf } },
          { binding: 3, resource: { buffer: paramsBuf } },
        ],
      });
    const accelBG = [bg(bufA)(accelPipeline), bg(bufB)(accelPipeline)];
    const kickBG = [bg(bufA)(kickPipeline), bg(bufB)(kickPipeline)];
    const driftBG = [bg(bufA)(driftPipeline), bg(bufB)(driftPipeline)];
    const ptsBG = [
      device.createBindGroup({ layout: ptsPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bufA } }, { binding: 3, resource: { buffer: paramsBuf } }] }),
      device.createBindGroup({ layout: ptsPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bufB } }, { binding: 3, resource: { buffer: paramsBuf } }] }),
    ];
    const bgBG = device.createBindGroup({ layout: bgPipeline.getBindGroupLayout(0), entries: [{ binding: 3, resource: { buffer: paramsBuf } }] });

    const s = {
      quality: 'med' as Quality,
      n: QUALITY.med.n,
      distance: +(params.periapsis ?? 1.0), // orbit radius in units of the fluid Roche radius
      densityRatio: +(params.density ?? 1.0), // rho_planet / rho_moon
      speed: 1,
      cur: 0, // which buffer (0=A,1=B) holds the current state
    };

    let dRoche = 0, dRigid = 0, r0 = 0, dt = 0, grainR = 0, GmParticle = 0, kSpring = 0, kDamp = 0, Tperi = 1;
    let needAccel = true;
    const P = new Float32Array(16);

    // Labels for the two Roche circles (HTML overlay, positioned in render()).
    const mkLabel = (text: string, color: string) => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = `position:absolute;transform:translate(-50%,-100%);white-space:nowrap;color:${color};font-size:0.72rem;`;
      stage.overlay.append(el);
      return el;
    };
    const fluidLabel = mkLabel('fluid Roche limit', '#e0695c');
    const rigidLabel = mkLabel('rigid', 'rgba(224,105,92,0.75)');

    function initParticles() {
      const { fluid, rigid } = rocheLimits(s.densityRatio);
      dRoche = fluid; dRigid = rigid;
      r0 = Math.max(1.1 * Rp + Rm0, s.distance * dRoche);
      const n = s.n;
      // The pile's mass follows from its radius and density (rho_moon = rho_planet / ratio).
      const moonMass = (4 / 3) * Math.PI * Rm0 ** 3 * (rhoM / s.densityRatio);
      // The grains lie in a plane, and a flat disk pulls its own edge ~2.2× harder than a sphere of
      // the same mass and radius does. Scale each grain's mass down by that factor so the pile's
      // self-gravity at its surface matches the 3D body the Roche formula describes.
      GmParticle = moonMass / n / 2.2;
      // Grains start on a hexagonal lattice that exactly fills a disk of radius Rm0.
      grainR = Rm0 * Math.sqrt(Math.PI / (2 * Math.sqrt(3) * n));
      // Contact stiffness: stiff enough that self-gravity squeezes grains by only ~10% of their
      // radius (the load grows with the surface gravity and with the number of grains per column).
      const gSurf = moonMass / (Rm0 * Rm0);
      kSpring = 18000 * gSurf * (n / 2048);
      const omegaC = Math.sqrt(2 * kSpring);
      kDamp = 0.3 * omegaC;

      const pts: [number, number][] = [];
      const sp = 2 * grainR, rows = Math.ceil((1.3 * Rm0) / (sp * 0.866));
      for (let j = -rows; j <= rows; j++) {
        for (let i = -rows - 1; i <= rows + 1; i++) {
          const x = (i + (j & 1) * 0.5) * sp, y = j * sp * 0.866;
          pts.push([x, y]);
        }
      }
      pts.sort((p, q) => p[0] * p[0] + p[1] * p[1] - (q[0] * q[0] + q[1] * q[1]));

      // Synchronous rotation: the pile starts tidally locked, i.e. at rest in the orbiting frame.
      const omega = Math.sqrt(GMp / r0 ** 3), vOrb = omega * r0;
      const data = new Float32Array(NMAX * 4);
      for (let i = 0; i < n; i++) {
        const dx = pts[i][0] + (Math.random() - 0.5) * 0.04 * grainR, dy = pts[i][1] + (Math.random() - 0.5) * 0.04 * grainR;
        data[i * 4 + 0] = r0 + dx;
        data[i * 4 + 1] = dy;
        data[i * 4 + 2] = -omega * dy;
        data[i * 4 + 3] = vOrb + omega * dx;
      }
      device.queue.writeBuffer(bufA, 0, data);
      device.queue.writeBuffer(bufB, 0, data);
      s.cur = 0;
      needAccel = true;

      // Timestep: resolve both the orbit and the stiffest thing in the problem, the contact springs.
      Tperi = 2 * Math.PI * Math.sqrt(r0 ** 3 / GMp);
      dt = Math.min(Tperi / 800, (2 * Math.PI) / omegaC / 14);
      loop.dt = dt;
      applySpeed();
      elapsed = 0;
    }
    // One orbit takes ~10 s of wall time at speed 1 (capped so wide orbits stay affordable).
    const applySpeed = () => { loop.timeScale = s.speed * Math.min(Tperi / 10, 1.6); };

    // Wide enough to keep most of the debris of a disruption in view.
    const viewHalfOf = () => Math.max(1.22 * (r0 + Rm0), 1.9 * dRoche);

    const loop = new Loop(step, render, 1 / 120);
    loop.maxSteps = 60;
    stage.onResize(() => loop.invalidate());

    let elapsed = 0;
    let enc: GPUCommandEncoder | null = null;
    function writeParams() {
      const w = stage.width, h = stage.height;
      P[0] = GMp; P[1] = Rp; P[2] = dRoche; P[3] = grainR * grainR * 0.35;
      P[4] = GmParticle; P[5] = dt; P[6] = s.n; P[7] = grainR;
      P[8] = kSpring; P[9] = kDamp; P[10] = viewHalfOf(); P[11] = w / h;
      P[12] = 1.7; P[13] = h; P[14] = dRigid; P[15] = 0;
      device.queue.writeBuffer(paramsBuf, 0, P);
    }

    // KDK leapfrog in the planet's inertial frame, recorded into one encoder per frame:
    // kick(h/2) with the stored accelerations → drift(h) → new accelerations → kick(h/2).
    function step(h: number) {
      elapsed += h;
      if (!enc) { writeParams(); enc = device.createCommandEncoder(); }
      const wg = Math.ceil(s.n / 64);
      const pass = enc.beginComputePass();
      if (needAccel) {
        pass.setPipeline(accelPipeline); pass.setBindGroup(0, accelBG[s.cur]); pass.dispatchWorkgroups(wg);
        needAccel = false;
      }
      pass.setPipeline(kickPipeline); pass.setBindGroup(0, kickBG[s.cur]); pass.dispatchWorkgroups(wg);
      pass.setPipeline(driftPipeline); pass.setBindGroup(0, driftBG[1 - s.cur]); pass.dispatchWorkgroups(wg);
      pass.setPipeline(accelPipeline); pass.setBindGroup(0, accelBG[s.cur]); pass.dispatchWorkgroups(wg);
      pass.setPipeline(kickPipeline); pass.setBindGroup(0, kickBG[s.cur]); pass.dispatchWorkgroups(wg);
      pass.end();
      s.cur = 1 - s.cur;
    }

    let readPending = false;
    function maybeReadback() {
      if (readPending) return;
      readPending = true;
      const src = s.cur === 0 ? bufA : bufB;
      const e = device.createCommandEncoder();
      const stride = Math.max(1, Math.floor(s.n / SAMPLES));
      // Sample grains spread across the buffer (the lattice is sorted by radius, so these span the
      // whole pile) to estimate where the pile is and how much of it is still together.
      for (let k = 0; k < SAMPLES; k++) e.copyBufferToBuffer(src, k * stride * 16, readBuf, k * 16, 16);
      device.queue.submit([e.finish()]);
      readBuf.mapAsync(GPUMapMode.READ).then(() => {
        const arr = new Float32Array(readBuf.getMappedRange().slice(0));
        readBuf.unmap();
        const xs: number[] = [], ys: number[] = [];
        for (let k = 0; k < SAMPLES; k++) { xs.push(arr[k * 4]); ys.push(arr[k * 4 + 1]); }
        const med = (v: number[]) => v.slice().sort((a, b) => a - b)[v.length >> 1];
        const cx = med(xs), cy = med(ys);
        let inside = 0;
        for (let k = 0; k < SAMPLES; k++) if (Math.hypot(xs[k] - cx, ys[k] - cy) < 2.5 * Rm0) inside++;
        distReadout.set(`${fmt(Math.hypot(cx, cy) / dRoche, 3)} × Roche`);
        boundReadout.set(`${Math.round((100 * inside) / SAMPLES)} %`);
        readPending = false;
      }).catch(() => { readPending = false; });
    }

    let frame = 0;
    function render(_alpha: number) {
      writeParams();
      const e = enc ?? device.createCommandEncoder();
      enc = null;
      const pass = e.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.01, g: 0.012, b: 0.02, a: 1 } }],
      });
      pass.setPipeline(bgPipeline);
      pass.setBindGroup(0, bgBG);
      pass.draw(3);
      pass.setPipeline(ptsPipeline);
      pass.setBindGroup(0, ptsBG[s.cur]);
      pass.draw(6, s.n);
      pass.end();
      device.queue.submit([e.finish()]);

      const vh = viewHalfOf(), H = stage.height, W = stage.width;
      const toPx = H / (2 * vh);
      // Labels sit just below each ring's lowest point, clear of a pile orbiting on the ring.
      fluidLabel.style.left = `${W / 2}px`; fluidLabel.style.top = `${H / 2 + (dRoche + Rm0) * toPx + 16}px`;
      rigidLabel.style.left = `${W / 2}px`; rigidLabel.style.top = `${H / 2 + dRigid * toPx + 16}px`;
      rigidLabel.style.display = (dRoche - dRigid - Rm0) * toPx > 34 ? '' : 'none';
      fluidLabel.style.display = H / 2 - (dRoche + Rm0) * toPx > 22 ? '' : 'none';

      if (frame++ % 8 === 0) maybeReadback();
    }
    onDestroy(() => enc?.finish());

    const panel = new Panel(host);
    const distReadout = panel.readout('Distance');
    const boundReadout = panel.readout('Still in the pile');
    const rocheReadout = panel.readout('Roche (fluid / rigid)');
    const updateRocheReadout = () => rocheReadout.set(`${fmt(dRoche, 3)} / ${fmt(dRigid, 3)} R_planet`);

    panel.slider('Orbit distance', { min: 0.5, max: 2.5, value: s.distance, step: 0.01, format: (v) => `${fmt(v, 3)} × Roche` }, (v) => { s.distance = v; initParticles(); updateRocheReadout(); loop.invalidate(); });
    panel.slider('Density ratio ρ_planet/ρ_moon', { min: 0.3, max: 5, value: s.densityRatio, step: 0.05 }, (v) => { s.densityRatio = v; initParticles(); updateRocheReadout(); loop.invalidate(); });
    panel.select('Grains', [
      { value: 'low', label: QUALITY.low.label },
      { value: 'med', label: QUALITY.med.label },
      { value: 'high', label: QUALITY.high.label },
    ], s.quality, (v) => { s.quality = v; s.n = QUALITY[v].n; initParticles(); loop.invalidate(); });
    panel.slider('Speed', { min: 0.1, max: 3, value: 1, step: 0.1 }, (v) => { s.speed = v; applySpeed(); });
    panel.button('Reset', () => { initParticles(); loop.invalidate(); }, true);

    initParticles();
    updateRocheReadout();

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
