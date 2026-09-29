// Chapter 23 flagship: toy hierarchical galaxy assembly on the GPU.
// Dark-matter clumps merge into one halo; gas tracers shock-heat, cool (t_cool < t_ff), settle into a
// rotating disk and form stars, which redden as they age. Supernova winds and AGN heating can be toggled.
// Physics: O(N × 2048) softened gravity + sub-grid recipes, all in one WGSL compute kernel (see assembly.wgsl).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import stepCode from './galaxy-formation/assembly.wgsl?raw';
import renderCode from './galaxy-formation/render.wgsl?raw';
import {
  makeICs, redshiftAt, AGE_NOW, UNIT_T_GYR, UNIT_M, FB, TCONV, COOLK, STRIDE,
} from './galaxy-formation/cosmo';

const NSRC = 2048;
const T0_GYR = 0.6;
const T_END = (AGE_NOW - T0_GYR) / UNIT_T_GYR;
const DT = 0.004;

async function checkModule(device: GPUDevice, code: string, label: string) {
  const mod = device.createShaderModule({ code, label });
  if (import.meta.env.DEV) {
    const info = await mod.getCompilationInfo();
    for (const m of info.messages) if (m.type === 'error') console.error(`[${label}] ${m.lineNum}:${m.linePos} ${m.message}`);
  }
  return mod;
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    // The scene is always black space (the render pass clears to opaque black); paint the canvas black
    // up front too, so the light HUD text stays readable before the first GPU frame lands.
    stage.canvas.style.background = '#000';
    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1'; // taller on phones
    stage.el.style.background = '#030409';
    const { ctx, format } = configureCanvas(stage.canvas, device);

    const stepMod = await checkModule(device, stepCode, 'gf-assembly-step');
    const renderMod = await checkModule(device, renderCode, 'gf-assembly-render');

    const stepPipe = device.createComputePipeline({ layout: 'auto', compute: { module: stepMod, entryPoint: 'step' } });
    const statPipe = device.createComputePipeline({ layout: 'auto', compute: { module: stepMod, entryPoint: 'countStats' } });
    const HDR: GPUTextureFormat = 'rgba16float';
    const add: GPUBlendComponent = { srcFactor: 'one', dstFactor: 'one', operation: 'add' };
    const drawPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderMod, entryPoint: 'vs' },
      fragment: { module: renderMod, entryPoint: 'fs', targets: [{ format: HDR, blend: { color: add, alpha: add } }] },
      primitive: { topology: 'triangle-list' },
    });
    const tonePipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderMod, entryPoint: 'vsFull' },
      fragment: { module: renderMod, entryPoint: 'fsTone', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    // ---- buffers --------------------------------------------------------------------------
    const paramBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const drawUBuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const toneBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const statBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const readBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    let parts: GPUBuffer[] = [];
    let stepBG: GPUBindGroup[] = [], statBG: GPUBindGroup[] = [], drawBG: GPUBindGroup[] = [];
    let hdrTex: GPUTexture | null = null, toneBG: GPUBindGroup | null = null;
    let destroyed = false;

    // ---- state -------------------------------------------------------------------------
    let N = Number(params.n ?? 65536), nDM = N >> 1, seed = 1;
    let cur = 0, stepNo = 0, t = 0, pending = 0, lambda = 0;
    let sn = 1, cooling = true, agn = true, showDM = true;
    let speed = 2;
    const sfh: { t: number; sfr: number }[] = [];

    function build() {
      for (const b of parts) b.destroy();
      const ic = makeICs(N, NSRC, seed);
      nDM = ic.nDM; lambda = ic.lambda;
      parts = [0, 1].map(() => device.createBuffer({ size: N * STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
      device.queue.writeBuffer(parts[0], 0, ic.data);
      stepBG = [0, 1].map((k) => device.createBindGroup({
        layout: stepPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: paramBuf } }, { binding: 1, resource: { buffer: parts[k] } }, { binding: 2, resource: { buffer: parts[1 - k] } }],
      }));
      statBG = [0, 1].map((k) => device.createBindGroup({
        layout: statPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: paramBuf } }, { binding: 1, resource: { buffer: parts[k] } }, { binding: 3, resource: { buffer: statBuf } }],
      }));
      drawBG = [0, 1].map((k) => device.createBindGroup({
        layout: drawPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: drawUBuf } }, { binding: 1, resource: { buffer: parts[k] } }],
      }));
      cur = 0; stepNo = 0; t = 0; pending = 0; sfh.length = 0;
      lambdaOut.set(fmt(lambda, 2));
    }

    const pbuf = new ArrayBuffer(80), pu = new Uint32Array(pbuf), pf = new Float32Array(pbuf);
    const h = 0.07;
    function writeParams() {
      pu[0] = N; pu[1] = NSRC; pu[2] = stepNo; pu[3] = (cooling ? 1 : 0) | (agn ? 2 : 0);
      pf[4] = DT; pf[5] = t; pf[6] = 0.025 * 0.025; pf[7] = h;
      pf[8] = 1 / NSRC; pf[9] = 105 / (32 * Math.PI * h ** 3); pf[10] = 0.5 * sn; pf[11] = TCONV;
      pf[12] = COOLK; pf[13] = 2.0 / UNIT_T_GYR; pf[14] = 1.6; pf[15] = 10 ** 5.9;
      pf[16] = 25; pf[17] = 2.0; pf[18] = 0; pf[19] = 0;
      device.queue.writeBuffer(paramBuf, 0, pbuf);
    }

    function resizeTargets() {
      hdrTex?.destroy();
      hdrTex = device.createTexture({
        size: [stage.canvas.width, stage.canvas.height], format: HDR,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      toneBG = device.createBindGroup({
        layout: tonePipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: hdrTex.createView() }, { binding: 1, resource: { buffer: toneBuf } }],
      });
    }

    // ---- stats readback (non-blocking) ------------------------------------------------------
    let reading = false;
    function applyStats(a: Uint32Array, tCode: number) {
      const mb = (FB * UNIT_M) / (N - nDM); // Msun per baryon particle
      const gas = a[0] + a[1] + a[2];
      const sfr = (a[5] * mb) / 1e8;        // Msun/yr over the last 100 Myr
      sfh.push({ t: T0_GYR + tCode * UNIT_T_GYR, sfr });
      mstarOut.set(`${fmt(a[3] * mb, 2)} M☉ (central ${fmt(a[4] * mb, 2)})`);
      fgasOut.set(`${fmt((100 * gas) / Math.max(1, gas + a[3]), 2)}% (hot ${fmt((100 * a[1]) / Math.max(1, gas), 2)}%)`);
      sfrOut.set(`${fmt(sfr, 2)} M☉/yr`);
    }

    // ---- camera, UI --------------------------------------------------------------------------
    const cam = new OrbitCamera(stage.canvas, { distance: 2.4, pitch: 0.45, yaw: 0.8, autoRotate: 0.06, minDistance: 0.3, maxDistance: 12 });
    cam.onChange = () => loop.invalidate();

    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;left:10px;top:8px;font:12px/1.45 JetBrains Mono, ui-monospace, monospace;color:#d8dcea;text-shadow:0 1px 2px #000;';
    const sfhCanvas = document.createElement('canvas');
    sfhCanvas.style.cssText = 'position:absolute;right:10px;bottom:10px;width:min(210px,40%);height:74px;';
    const legend = document.createElement('div');
    legend.style.cssText = 'position:absolute;right:10px;top:8px;font:11px/1.5 JetBrains Mono, ui-monospace, monospace;color:#c8ccda;text-align:right;text-shadow:0 1px 2px #000;';
    legend.innerHTML = [
      ['#5a45b0', 'dark matter'], ['#3a9cff', 'cold gas'], ['#ff6a2a', 'hot gas'], ['#4dffc0', 'SN wind'], ['#ff45c0', 'AGN-heated'],
      ['#c8dcff', 'young stars'], ['#ffb46a', 'old stars'],
    ].map(([c, l]) => `${l} <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c}"></span>`).join('<br>');
    stage.overlay.append(hud, legend, sfhCanvas);

    const loop = new Loop(() => { if (t < T_END) pending += speed; }, render, 1 / 60);
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Restart', () => { build(); loop.invalidate(); });
    panel.button('New seed', () => { seed++; build(); loop.invalidate(); });
    panel.slider('SN feedback', { min: 0, max: 3, value: sn, step: 0.05 }, (v) => (sn = v));
    panel.toggle('AGN feedback', agn, (v) => (agn = v));
    panel.toggle('Cooling', cooling, (v) => (cooling = v));
    panel.toggle('Dark matter', showDM, (v) => { showDM = v; loop.invalidate(); });
    panel.select('Particles', [
      { value: '32768', label: '32k' }, { value: '65536', label: '65k' }, { value: '131072', label: '131k' },
    ], String(N), (v) => { N = Number(v); build(); loop.invalidate(); });
    panel.slider('Speed', { min: 1, max: 4, value: speed, step: 1, format: (v) => `${v}×` }, (v) => (speed = v));
    const mstarOut = panel.readout('M★');
    const fgasOut = panel.readout('gas fraction');
    const sfrOut = panel.readout('SFR');
    const lambdaOut = panel.readout('spin λ');

    stage.onResize(() => { resizeTargets(); loop.invalidate(); });
    build();

    const du = new Float32Array(32);
    let frame = 0;
    function render(_a: number, frameDt: number) {
      if (destroyed || !toneBG) return;
      if (cam.update(frameDt)) { /* auto-rotating */ }
      // physics steps: one submit each, because the uniform (time, step, rng salt) changes per step
      const nSteps = Math.min(pending, 8);
      pending = 0;
      for (let s = 0; s < nSteps && t < T_END; s++) {
        writeParams();
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(stepPipe);
        pass.setBindGroup(0, stepBG[cur]);
        pass.dispatchWorkgroups(Math.ceil(N / 256));
        pass.end();
        device.queue.submit([enc.finish()]);
        cur = 1 - cur; stepNo++; t += DT;
      }

      const aspect = stage.width / stage.height;
      du.set(cam.viewProj(aspect), 0);
      const v = cam.viewMatrix();
      du.set([v[0], v[4], v[8], 0], 16);    // camera right (world space)
      du.set([v[1], v[5], v[9], 0], 20);    // camera up
      const gain = 0.3 * Math.pow(65536 / N, 0.75) * Math.pow(2.4 / cam.distance, 0.5);
      du.set([t, gain, showDM ? 0.08 : 0, Math.min(1.6, Math.max(0.5, cam.distance / 2.4))], 24);
      du.set([UNIT_T_GYR, 0, 0, 0], 28);
      device.queue.writeBuffer(drawUBuf, 0, du);
      device.queue.writeBuffer(toneBuf, 0, new Float32Array([1.4, 0.004, 0.005, 0.012]));

      const enc = device.createCommandEncoder();
      const wantStats = !reading && frame++ % 12 === 0;
      if (wantStats) {
        writeParams(); // time for the "young star" age cut
        enc.clearBuffer(statBuf);
        const cp = enc.beginComputePass();
        cp.setPipeline(statPipe);
        cp.setBindGroup(0, statBG[cur]);
        cp.dispatchWorkgroups(Math.ceil(N / 256));
        cp.end();
        enc.copyBufferToBuffer(statBuf, 0, readBuf, 0, 32);
      }
      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: hdrTex!.createView(), clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }],
      });
      rp.setPipeline(drawPipe);
      rp.setBindGroup(0, drawBG[cur]);
      if (showDM) rp.draw(6, N, 0, 0); else rp.draw(6, N - nDM, 0, nDM);
      rp.end();
      const tp = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
      });
      tp.setPipeline(tonePipe);
      tp.setBindGroup(0, toneBG);
      tp.draw(3);
      tp.end();
      device.queue.submit([enc.finish()]);

      if (wantStats) {
        reading = true;
        const tAt = t;
        readBuf.mapAsync(GPUMapMode.READ).then(() => {
          if (destroyed) return;
          const a = new Uint32Array(readBuf.getMappedRange().slice(0));
          readBuf.unmap();
          reading = false;
          applyStats(a, tAt);
        }).catch(() => { reading = false; });
      }

      // HUD
      const tG = T0_GYR + t * UNIT_T_GYR;
      hud.innerHTML = `t = <b>${tG.toFixed(2)}</b> Gyr &nbsp; z = <b>${fmt(Math.max(0, redshiftAt(tG)), 3)}</b>` +
        `<br><span style="opacity:.7">toy model · box ≈ 800 kpc · ${N >= 1024 ? `${Math.round(N / 1024)}k` : N} particles</span>` +
        (t >= T_END ? '<br><b>z = 0: today</b>' : '');
      drawSFH();
    }

    const sctx = sfhCanvas.getContext('2d')!;
    function drawSFH() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = sfhCanvas.clientWidth, H = sfhCanvas.clientHeight;
      if (!W) return;
      if (sfhCanvas.width !== Math.round(W * dpr)) { sfhCanvas.width = Math.round(W * dpr); sfhCanvas.height = Math.round(H * dpr); }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.fillStyle = 'rgba(10,12,22,0.6)'; sctx.fillRect(0, 0, W, H);
      sctx.font = '10px JetBrains Mono, ui-monospace, monospace';
      sctx.fillStyle = '#aab';
      sctx.fillText('star-formation rate vs time', 6, 12);
      sctx.fillText('0', 4, H - 4); sctx.fillText('13.8 Gyr', W - 44, H - 4);
      const max = Math.max(1, ...sfh.map((s) => s.sfr));
      sctx.fillText(`${fmt(max, 2)} M☉/yr`, W - 66, 12);
      sctx.strokeStyle = '#8fd0ff'; sctx.lineWidth = 1.4;
      sctx.beginPath();
      sfh.forEach((s, k) => {
        const X = 6 + ((W - 12) * s.t) / AGE_NOW, Y = H - 14 - ((H - 32) * s.sfr) / max;
        k ? sctx.lineTo(X, Y) : sctx.moveTo(X, Y);
      });
      sctx.stroke();
    }

    const destroyAll = () => {
      destroyed = true;
      loop.destroy();
      for (const b of parts) b.destroy();
      for (const b of [paramBuf, drawUBuf, toneBuf, statBuf, readBuf]) b.destroy();
      hdrTex?.destroy();
    };
    onDestroy(destroyAll);
    if (import.meta.env.DEV) {
      // dev-only hook for headless verification: advance n steps and render once
      (window as unknown as Record<string, unknown>).__gfAssembly = {
        advance: (n: number) => { for (let k = 0; k < n; k += 8) { pending = Math.min(8, n - k); render(0, 0); } },
        state: () => ({ tGyr: T0_GYR + t * UNIT_T_GYR, readouts: panel.el.innerText }),
        set: (o: { sn?: number; agn?: boolean; cooling?: boolean }) => { if (o.sn !== undefined) sn = o.sn; if (o.agn !== undefined) agn = o.agn; if (o.cooling !== undefined) cooling = o.cooling; },
        restart: () => build(),
      };
    }
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (vis) => loop.setVisible(vis), destroy: destroyAll };
  },
});
