// Chapter 9 flagship: a self-gravitating rubble pile passing (or orbiting) close to a planet.
// A few thousand point-mass grains feel the planet's *exact* gravity plus their own mutual
// gravity (softened, with a soft-sphere contact repulsion). Outside the Roche limit the pile's
// self-gravity wins and it stays together; inside, the planet's differential pull wins and it
// stretches into a "string of pearls" or smears into a ring. All physics runs on the GPU.

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
const Rm0 = 0.12; // moon/comet radius (fixed), in units of Rp
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
    const bgPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsBg' },
      fragment: { module, entryPoint: 'fsBg', targets: [{ format, blend: {
        color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'zero' },
      } }] },
      primitive: { topology: 'triangle-list' },
    });
    const ptsPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsPts' },
      fragment: { module, entryPoint: 'fsPts', targets: [{ format, blend: {
        color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
        alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
      } }] },
      primitive: { topology: 'triangle-list' },
    });

    const NMAX = QUALITY.high.n;
    const bufA = device.createBuffer({ size: NMAX * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const bufB = device.createBuffer({ size: NMAX * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const accelBuf = device.createBuffer({ size: NMAX * 8, usage: GPUBufferUsage.STORAGE });
    const paramsBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const readBuf = device.createBuffer({ size: 16 * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
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
      periapsis: +(params.periapsis ?? 1.0), // in units of the fluid Roche radius
      densityRatio: +(params.density ?? 1.0), // rho_planet / rho_moon
      speed: 1,
      cur: 0, // which buffer (0=A,1=B) holds the current state
    };

    let dRoche = 0, dRigid = 0, r0 = 0, dt = 0, grainR = 0, GmParticle = 0;
    const P = new Float32Array(16);

    function initParticles() {
      const { fluid, rigid } = rocheLimits(s.densityRatio);
      dRoche = fluid; dRigid = rigid;
      r0 = Math.max(1.15 * Rp, s.periapsis * dRoche);
      const rhoM_ = rhoM / s.densityRatio;
      const moonMass = (4 / 3) * Math.PI * Rm0 ** 3 * rhoM_;
      GmParticle = moonMass / s.n;
      grainR = Rm0 / Math.sqrt(s.n) * 1.3;

      const data = new Float32Array(NMAX * 4);
      for (let i = 0; i < s.n; i++) {
        // Uniform sample in a disk of radius Rm0 around the periapsis point.
        const rr = Rm0 * Math.sqrt(Math.random());
        const th = Math.random() * 2 * Math.PI;
        const px = r0 + rr * Math.cos(th);
        const py = rr * Math.sin(th);
        const rad = Math.hypot(px, py);
        const vCirc = Math.sqrt(GMp / rad);
        data[i * 4 + 0] = px;
        data[i * 4 + 1] = py;
        data[i * 4 + 2] = (-py / rad) * vCirc;
        data[i * 4 + 3] = (px / rad) * vCirc;
      }
      device.queue.writeBuffer(bufA, 0, data);
      device.queue.writeBuffer(bufB, 0, data);
      s.cur = 0;

      // Timestep: a fraction of the orbital period at periapsis, small enough that periapsis
      // passage (the fastest, most curved part of the orbit) stays stable.
      const Tperi = 2 * Math.PI * Math.sqrt(r0 ** 3 / GMp);
      dt = Tperi / 800;
      loop.dt = dt;
    }

    const viewHalfOf = () => Math.max(3.4 * dRoche, 1.35 * r0);

    const loop = new Loop(step, render, 1 / 120);
    stage.onResize(() => loop.invalidate());

    let elapsed = 0;
    function step(h: number) {
      elapsed += h;
      const halfDt = h / 2;
      // KDK leapfrog, in the planet's inertial frame: kick(h/2) → drift(h) → kick(h/2).
      const write = (dtField: number) => {
        P[5] = dtField;
        device.queue.writeBuffer(paramsBuf, 0, P);
      };
      const n = s.n, cur = s.cur;
      const wg = Math.ceil(n / 64);

      let enc = device.createCommandEncoder();
      let pass = enc.beginComputePass();
      pass.setPipeline(accelPipeline); pass.setBindGroup(0, accelBG[cur]); pass.dispatchWorkgroups(wg);
      pass.end();
      device.queue.submit([enc.finish()]);

      write(halfDt);
      enc = device.createCommandEncoder();
      pass = enc.beginComputePass();
      pass.setPipeline(kickPipeline); pass.setBindGroup(0, kickBG[cur]); pass.dispatchWorkgroups(wg);
      pass.end();
      device.queue.submit([enc.finish()]);
      const mid = 1 - cur;

      write(h);
      enc = device.createCommandEncoder();
      pass = enc.beginComputePass();
      pass.setPipeline(driftPipeline); pass.setBindGroup(0, driftBG[mid]); pass.dispatchWorkgroups(wg);
      pass.end();
      device.queue.submit([enc.finish()]);
      const cur2 = 1 - mid; // == cur

      enc = device.createCommandEncoder();
      pass = enc.beginComputePass();
      pass.setPipeline(accelPipeline); pass.setBindGroup(0, accelBG[cur2]); pass.dispatchWorkgroups(wg);
      pass.end();
      device.queue.submit([enc.finish()]);

      write(halfDt);
      enc = device.createCommandEncoder();
      pass = enc.beginComputePass();
      pass.setPipeline(kickPipeline); pass.setBindGroup(0, kickBG[cur2]); pass.dispatchWorkgroups(wg);
      pass.end();
      device.queue.submit([enc.finish()]);
      s.cur = 1 - cur2;
    }

    let readPending = false;
    function maybeReadback() {
      if (readPending) return;
      readPending = true;
      const src = s.cur === 0 ? bufA : bufB;
      const enc = device.createCommandEncoder();
      const stride = Math.max(1, Math.floor(s.n / 16));
      // Sample 16 particles spread across the buffer to estimate the cluster's centre and spread —
      // cheap, and plenty for a live readout (not for physics).
      for (let k = 0; k < 16; k++) enc.copyBufferToBuffer(src, (k * stride) * 16, readBuf, k * 16, 16);
      device.queue.submit([enc.finish()]);
      readBuf.mapAsync(GPUMapMode.READ).then(() => {
        const arr = new Float32Array(readBuf.getMappedRange().slice(0));
        readBuf.unmap();
        let cx = 0, cy = 0;
        for (let k = 0; k < 16; k++) { cx += arr[k * 4]; cy += arr[k * 4 + 1]; }
        cx /= 16; cy /= 16;
        let spread = 0;
        for (let k = 0; k < 16; k++) spread += Math.hypot(arr[k * 4] - cx, arr[k * 4 + 1] - cy);
        spread /= 16;
        const distNow = Math.hypot(cx, cy);
        distReadout.set(`${fmt(distNow / dRoche, 3)} × Roche`);
        const bound = spread < Rm0 * 2.2 ? 1 : Math.max(0, 1 - (spread - Rm0 * 2.2) / (Rm0 * 6));
        boundReadout.set(`${fmt(bound * 100, 3)} %`);
        readPending = false;
      });
    }

    function render(_alpha: number) {
      const w = stage.width, h = stage.height, aspect = w / h;
      const viewHalf = viewHalfOf();
      P[0] = GMp; P[1] = Rp; P[2] = dRoche; P[3] = grainR * grainR * 0.35;
      P[4] = GmParticle; /* P[5]=dt written per-dispatch */ P[6] = s.n; P[7] = grainR;
      P[8] = 4000; P[9] = 6; P[10] = viewHalf; P[11] = aspect;
      P[12] = 5; P[13] = elapsed; P[14] = 0; P[15] = 0;
      device.queue.writeBuffer(paramsBuf, 0, P);

      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.01, g: 0.012, b: 0.02, a: 1 } }],
      });
      pass.setPipeline(bgPipeline);
      pass.setBindGroup(0, bgBG);
      pass.draw(3);
      pass.setPipeline(ptsPipeline);
      pass.setBindGroup(0, ptsBG[s.cur]);
      pass.draw(6, s.n);
      pass.end();
      device.queue.submit([enc.finish()]);

      if ((Math.random() < 0.08)) maybeReadback();
    }

    const panel = new Panel(host);
    const distReadout = panel.readout('Distance');
    const boundReadout = panel.readout('Bound fraction');
    const rocheReadout = panel.readout('Roche (fluid / rigid)');
    const updateRocheReadout = () => rocheReadout.set(`${fmt(dRoche, 3)} / ${fmt(dRigid, 3)} R_planet`);

    panel.slider('Orbit distance', { min: 0.4, max: 2.5, value: s.periapsis, step: 0.01 }, (v) => { s.periapsis = v; initParticles(); updateRocheReadout(); loop.invalidate(); });
    panel.slider('Density ratio ρ_planet/ρ_moon', { min: 0.3, max: 5, value: s.densityRatio, step: 0.05 }, (v) => { s.densityRatio = v; initParticles(); updateRocheReadout(); loop.invalidate(); });
    panel.select('Particles', [
      { value: 'low', label: QUALITY.low.label },
      { value: 'med', label: QUALITY.med.label },
      { value: 'high', label: QUALITY.high.label },
    ], s.quality, (v) => { s.quality = v; s.n = QUALITY[v].n; initParticles(); });
    panel.slider('Speed', { min: 0.1, max: 4, value: 1, step: 0.1 }, (v) => (loop.timeScale = v));
    panel.button('Reset', () => { elapsed = 0; initParticles(); loop.invalidate(); }, true);

    initParticles();
    updateRocheReadout();

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
