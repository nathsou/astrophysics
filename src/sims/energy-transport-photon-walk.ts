// Chapter 13 flagship: GPU Monte Carlo radiative transfer.
// Thousands to millions of photon packets random-walk out of a plane-parallel slab of optical
// depth tau (in units of the mean free path ell = 1/(kappa*rho)). Each packet samples an
// exponential path length -ln(u)/(kappa*rho) and an isotropic direction every scatter; with
// probability (1 - albedo) it thermalises (is absorbed) instead of scattering again.
// See src/sims/energy-transport/photonwalk.wgsl for the compute step and render.wgsl for the
// glowing point-sprite renderer.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange, cssColor } from '../lib/ui/theme';
import computeSrc from './energy-transport/photonwalk.wgsl?raw';
import renderSrc from './energy-transport/render.wgsl?raw';

const NBUCKETS = 64;
const PHOTON_BYTES = 32; // x,z,mu,t (f32) + state,rng,pad,pad (u32)

async function checkShader(mod: GPUShaderModule, name: string) {
  const info = await mod.getCompilationInfo();
  for (const m of info.messages) if (m.type === 'error') console.error(`[energy-transport-photon-walk] ${name}:${m.lineNum}:${m.linePos} ${m.message}`);
}

type Mode = 'slab' | 'sun';

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9, maxDpr: 2 });
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;gap:8px;margin-top:8px;grid-template-columns:1fr 1fr;';
    const c1 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    for (const c of [c1, c2]) c.style.cssText = 'width:100%;height:150px;display:block;';
    wrap.append(c1, c2);
    host.append(wrap);

    const timePlot = new Plot(c1, { x: { min: 0, max: 1, label: 't  (mean free paths / c)' }, y: { min: 0, max: 1, label: 'escaped photons' }, title: 'Escape-time histogram' });
    const muPlot = new Plot(c2, { x: { min: 0, max: 1, label: 'μ = cos θ (exit angle)' }, y: { min: 0, max: 1, label: 'intensity (norm.)' }, title: 'Limb darkening' });

    let pal = palette();
    onThemeChange(() => { pal = palette(); });

    const s = {
      mode: (params.mode as Mode) ?? 'slab',
      tau: 30,
      albedo: 0.97,
      quality: 1, // 0=32k 1=131k 2=524k
    };
    const COUNTS = [32768, 131072, 524288];

    computeSrc.length; // keep import referenced
    const computeMod = device.createShaderModule({ code: computeSrc });
    const renderMod = device.createShaderModule({ code: renderSrc });
    await checkShader(computeMod, 'photonwalk');
    await checkShader(renderMod, 'render');

    const computePipe = device.createComputePipeline({ layout: 'auto', compute: { module: computeMod, entryPoint: 'cs' } });
    const renderPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderMod, entryPoint: 'vs' },
      fragment: {
        module: renderMod,
        entryPoint: 'fs',
        targets: [{ format, blend: { color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' } } }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const paramsBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const viewBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const muHistBuf = device.createBuffer({ size: NBUCKETS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const tHistBuf = device.createBuffer({ size: NBUCKETS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const counterBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const readMuBuf = device.createBuffer({ size: NBUCKETS * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readTBuf = device.createBuffer({ size: NBUCKETS * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readCountBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

    let photonBuf: GPUBuffer | null = null;
    let computeBind: GPUBindGroup, renderBind: GPUBindGroup;
    let n = COUNTS[s.quality];

    function tScale() { return Math.max(4, s.tau * s.tau * 3); }

    function allocate() {
      n = COUNTS[s.quality];
      photonBuf?.destroy();
      photonBuf = device.createBuffer({ size: n * PHOTON_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      resetPhotons();
      computeBind = device.createBindGroup({
        layout: computePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: paramsBuf } },
          { binding: 1, resource: { buffer: photonBuf } },
          { binding: 2, resource: { buffer: muHistBuf } },
          { binding: 3, resource: { buffer: tHistBuf } },
          { binding: 4, resource: { buffer: counterBuf } },
        ],
      });
      renderBind = device.createBindGroup({
        layout: renderPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: viewBuf } },
          { binding: 1, resource: { buffer: photonBuf } },
        ],
      });
    }

    function resetPhotons() {
      const buf = new ArrayBuffer(n * PHOTON_BYTES);
      const f32 = new Float32Array(buf);
      const u32 = new Uint32Array(buf);
      for (let i = 0; i < n; i++) {
        const o = i * 8;
        f32[o + 0] = 0; // x
        f32[o + 1] = s.tau; // z (start at the base)
        f32[o + 2] = 1; // mu
        f32[o + 3] = 0; // t
        u32[o + 4] = 1; // state = active
        u32[o + 5] = (i * 2654435761) ^ 0x9e3779b9;
        u32[o + 6] = 0;
        u32[o + 7] = 0;
      }
      device.queue.writeBuffer(photonBuf!, 0, buf);
      device.queue.writeBuffer(counterBuf, 0, new Uint32Array([n, 0, 0, 0]));
      device.queue.writeBuffer(muHistBuf, 0, new Uint32Array(NBUCKETS));
      device.queue.writeBuffer(tHistBuf, 0, new Uint32Array(NBUCKETS));
      timeSeries.fill(0);
      muSeries.fill(0);
    }

    allocate();

    const timeSeries = new Uint32Array(NBUCKETS);
    const muSeries = new Uint32Array(NBUCKETS);
    const counts = { active: n, escaped: 0, absorbed: 0 };
    let frame = 0;
    let reading = false;

    async function readBack() {
      if (reading) return;
      reading = true;
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(muHistBuf, 0, readMuBuf, 0, NBUCKETS * 4);
      enc.copyBufferToBuffer(tHistBuf, 0, readTBuf, 0, NBUCKETS * 4);
      enc.copyBufferToBuffer(counterBuf, 0, readCountBuf, 0, 16);
      device.queue.submit([enc.finish()]);
      try {
        await Promise.all([readMuBuf.mapAsync(GPUMapMode.READ), readTBuf.mapAsync(GPUMapMode.READ), readCountBuf.mapAsync(GPUMapMode.READ)]);
        muSeries.set(new Uint32Array(readMuBuf.getMappedRange()));
        timeSeries.set(new Uint32Array(readTBuf.getMappedRange()));
        const cc = new Uint32Array(readCountBuf.getMappedRange());
        counts.active = cc[0]; counts.escaped = cc[1]; counts.absorbed = cc[2];
        readMuBuf.unmap(); readTBuf.unmap(); readCountBuf.unmap();
      } catch { /* device may be busy; skip this frame's readback */ }
      reading = false;
    }

    const panel = new Panel(host);
    panel.select('Scene', [{ value: 'slab', label: 'Slab' }, { value: 'sun', label: 'Solar interior' }], s.mode, (v) => { s.mode = v as Mode; invalidateAll(); });
    const tauCtl = panel.slider('Optical depth τ = L/ℓ', { min: 2, max: 2000, value: s.tau, log: true }, (v) => { s.tau = v; resetPhotons(); invalidateAll(); });
    panel.slider('Scattering albedo', { min: 0.5, max: 0.999, value: s.albedo, step: 0.001 }, (v) => { s.albedo = v; });
    panel.select('Photons', [{ value: '0', label: '32,768' }, { value: '1', label: '131,072' }, { value: '2', label: '524,288' }], String(s.quality), (v) => { s.quality = +v; allocate(); });
    panel.button('Restart', () => resetPhotons());
    const rActive = panel.readout('Active');
    const rEscaped = panel.readout('Escaped');
    const rAbsorbed = panel.readout('Absorbed');
    const rPredicted = panel.readout('Predicted diffusion time  t ≈ τ²ℓ/c');
    const rReal = panel.readout('Sun: ℓ ≈ 1 cm ⇒ escape time');

    function invalidateAll() { loop.invalidate(); }

    function updateReadouts() {
      rActive.set(fmt(counts.active, 4));
      rEscaped.set(fmt(counts.escaped, 4));
      rAbsorbed.set(fmt(counts.absorbed, 4));
      const predSteps = s.tau * s.tau;
      rPredicted.set(`${fmt(predSteps, 3)} mean free paths`);
      if (s.mode === 'sun') {
        // ell ~ 1 cm in the deep solar interior; R_sun in cm; t = tau^2 * ell / c
        const ellCm = 1;
        const RsunCm = 6.957e10;
        const tauReal = RsunCm / ellCm;
        const tSec = (tauReal * tauReal * ellCm * 1e-2) / 2.998e8;
        const tYr = tSec / 3.15576e7;
        rReal.set(`~${fmt(tYr, 3)} yr (τ ≈ ${fmt(tauReal, 2)})`);
      } else {
        rReal.set('switch scene to see the Sun’s numbers');
      }
    }

    function drawPlots() {
      const total = Math.max(1, counts.escaped);
      timePlot.o.x.max = tScale();
      let maxT = 1;
      for (const v of timeSeries) maxT = Math.max(maxT, v);
      timePlot.o.y.max = maxT * 1.15;
      timePlot.draw(() => {
        const bw = timePlot.pw / NBUCKETS;
        for (let i = 0; i < NBUCKETS; i++) {
          const v = timeSeries[i];
          if (!v) continue;
          const x0 = timePlot.px((i / NBUCKETS) * tScale());
          const y0 = timePlot.py(0);
          const y1 = timePlot.py(v);
          timePlot.ctx.fillStyle = pal.series[0];
          timePlot.ctx.globalAlpha = 0.85;
          timePlot.ctx.fillRect(x0, y1, Math.max(1, bw - 1), y0 - y1);
          timePlot.ctx.globalAlpha = 1;
        }
        timePlot.vline(s.tau * s.tau, { color: pal.accent2, label: 'τ²' });
      });

      let maxMu = 1;
      for (const v of muSeries) maxMu = Math.max(maxMu, v);
      muPlot.o.y.max = 1.15;
      muPlot.draw(() => {
        const bw = muPlot.pw / NBUCKETS;
        for (let i = 0; i < NBUCKETS; i++) {
          const mu = (i + 0.5) / NBUCKETS;
          const v = muSeries[i] / maxMu;
          const x0 = muPlot.px(mu - 0.5 / NBUCKETS);
          const y0 = muPlot.py(0);
          const y1 = muPlot.py(v);
          muPlot.ctx.fillStyle = pal.series[0];
          muPlot.ctx.globalAlpha = 0.8;
          muPlot.ctx.fillRect(x0, y1, Math.max(1, bw - 1), y0 - y1);
          muPlot.ctx.globalAlpha = 0;
        }
        // Eddington limb-darkening law I(mu) ~ 0.4 + 0.6 mu, normalised to peak at mu=1
        muPlot.fn((mu) => (0.4 + 0.6 * mu) / 1.0, { color: pal.accent, width: 2 });
      });
    }

    const colA = cssColor('--series-1');
    const colB = cssColor('--series-3');

    function writeUniforms() {
      device.queue.writeBuffer(paramsBuf, 0, new Float32Array([s.tau, s.albedo, 0, 0]));
      device.queue.writeBuffer(paramsBuf, 8, new Uint32Array([(Math.random() * 4294967295) >>> 0, 6, n, 0]));
      device.queue.writeBuffer(paramsBuf, 20, new Float32Array([tScale()]));
      const aspect = stage.width / stage.height;
      const viewF = new Float32Array(12);
      viewF[0] = s.tau; viewF[1] = aspect; viewF[2] = Math.max(2, 5 - Math.log10(s.tau)) * 0.002 + 0.004; viewF[3] = 0;
      viewF.set(colA, 4);
      viewF.set(colB, 8);
      device.queue.writeBuffer(viewBuf, 0, viewF);
      device.queue.writeBuffer(viewBuf, 12, new Uint32Array([n]));
    }

    function step() {
      writeUniforms();
      const enc = device.createCommandEncoder();
      const cp = enc.beginComputePass();
      cp.setPipeline(computePipe);
      cp.setBindGroup(0, computeBind);
      cp.dispatchWorkgroups(Math.ceil(n / 64));
      cp.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.02, g: 0.02, b: 0.035, a: 1 } }] });
      rp.setPipeline(renderPipe);
      rp.setBindGroup(0, renderBind);
      rp.draw(6, n);
      rp.end();
      device.queue.submit([enc.finish()]);
      frame++;
      if (frame % 6 === 0) readBack();
      updateReadouts();
      if (frame % 4 === 0) drawPlots();
    }

    const loop = new Loop(step, () => {}, 1 / 60);
    stage.onResize(() => { timePlot.resize(c1.clientWidth, c1.clientHeight, stage.dpr); muPlot.resize(c2.clientWidth, c2.clientHeight, stage.dpr); loop.invalidate(); });
    const roTime = new ResizeObserver(() => timePlot.resize(c1.clientWidth, c1.clientHeight, window.devicePixelRatio || 1));
    const roMu = new ResizeObserver(() => muPlot.resize(c2.clientWidth, c2.clientHeight, window.devicePixelRatio || 1));
    roTime.observe(c1); roMu.observe(c2);
    c1.width = c1.clientWidth; c1.height = c1.clientHeight;
    c2.width = c2.clientWidth; c2.height = c2.clientHeight;
    timePlot.resize(c1.clientWidth, c1.clientHeight, 1);
    muPlot.resize(c2.clientWidth, c2.clientHeight, 1);

    onDestroy(() => {
      roTime.disconnect(); roMu.disconnect();
      photonBuf?.destroy();
      paramsBuf.destroy(); viewBuf.destroy(); muHistBuf.destroy(); tHistBuf.destroy(); counterBuf.destroy();
      readMuBuf.destroy(); readTBuf.destroy(); readCountBuf.destroy();
    });

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
