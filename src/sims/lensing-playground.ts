// Chapter 24 flagship: real-time gravitational-lensing playground.
// Every pixel of the image plane is a ray traced *backwards* to the source plane with the lens equation
// beta = theta - alpha(theta) (inverse ray shooting). Critical curves come from det A = 0 per pixel;
// caustics are found in a compute pass that maps critical-curve segments through the lens equation.
// Units: angles in "view units" (1 unit = 1 arcsec for galaxy lenses, 10 arcsec for the cluster, 1 mas for a star).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import common from './lensing/common.wgsl?raw';
import renderSrc from './lensing/render.wgsl?raw';
import causticSrc from './lensing/caustic.wgsl?raw';

type Model = 'point' | 'sis' | 'sie' | 'cluster';
const MODEL_ID: Record<Model, number> = { point: 0, sis: 1, sie: 2, cluster: 3 };
const UNIT: Record<Model, [number, string]> = { point: [1, 'mas'], sis: [1, '″'], sie: [1, '″'], cluster: [10, '″'] };

// Cluster: a dominant NFW halo plus member galaxies (x, y, strength, rs; rs = 0 → SIS)
const CLUSTER: [number, number, number, number][] = [
  [0, 0, 0.55, 2.2],
  [0.35, 0.15, 0.22, 0],
  [-1.5, 0.6, 0.18, 0],
  [1.4, -0.9, 0.15, 0],
  [-0.6, -1.3, 0.12, 0],
  [2.3, 1.1, 0.1, 0],
];

async function checkShader(mod: GPUShaderModule, name: string) {
  const info = await mod.getCompilationInfo();
  for (const m of info.messages) if (m.type === 'error') console.error(`[lensing-playground] ${name}:${m.lineNum}:${m.linePos} ${m.message}`);
}

export default defineSim({
  gpu: true,
  async mount({ host, params }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 10, maxDpr: 2 });
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    // 2D overlay for markers and labels
    const over = document.createElement('canvas');
    over.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab';
    stage.el.append(over);
    const g2 = over.getContext('2d')!;
    let pal = palette();
    onThemeChange(() => { pal = palette(); dirty = true; });

    // ---- state
    const s = {
      model: (params.model as Model) ?? 'sie',
      E: 1.0, q: 0.7, phi: 0.5, gamma: 0.0, gphi: 0.3,
      lens: [0, 0] as [number, number],
      src: [0.25, 0.1] as [number, number],
      srcSize: 0.35, srcType: 0,
      crit: true, caus: true, mag: false, light: true,
      ss: 2,
    };

    const common2 = common;
    const renderMod = device.createShaderModule({ code: common2 + renderSrc });
    const causMod = device.createShaderModule({ code: common2 + causticSrc });
    checkShader(renderMod, 'render'); checkShader(causMod, 'caustic');

    const ubuf = device.createBuffer({ size: 240, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const U = new Float32Array(60);
    const renderPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderMod, entryPoint: 'vs' },
      fragment: { module: renderMod, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const causPipe = device.createComputePipeline({ layout: 'auto', compute: { module: causMod, entryPoint: 'cs' } });

    let cbuf: GPUBuffer | null = null;
    let rBind: GPUBindGroup, cBind: GPUBindGroup;
    let W = 1, H = 1;
    function allocate() {
      W = stage.canvas.width; H = stage.canvas.height;
      cbuf?.destroy();
      cbuf = device.createBuffer({ size: Math.max(16, W * H * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      rBind = device.createBindGroup({ layout: renderPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: cbuf } }] });
      cBind = device.createBindGroup({ layout: causPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: cbuf } }] });
    }

    const viewH = 5.4; // view units across the canvas height
    const scale = () => viewH / H; // units per device px
    // CSS px ↔ view units
    const toUnits = (x: number, y: number): [number, number] => {
      const k = viewH / stage.height;
      return [(x - stage.width / 2) * k, -(y - stage.height / 2) * k];
    };
    const toCss = (u: number, v: number): [number, number] => {
      const k = stage.height / viewH;
      return [stage.width / 2 + u * k, stage.height / 2 - v * k];
    };

    function writeUniforms() {
      U.fill(0);
      U.set([W, H, 0, 0], 0);
      U.set([scale(), MODEL_ID[s.model], s.ss, performance.now() / 1000], 4);
      U.set([s.lens[0], s.lens[1], s.E, s.q], 8);
      U.set([s.phi, s.gamma, s.gphi, CLUSTER.length], 12);
      U.set([s.src[0], s.src[1], s.srcSize, s.srcType], 16);
      U.set([+s.crit, +s.caus, +s.mag, +(s.light && s.model !== 'point')], 20);
      U.set([W, H, 1.6, 0], 24);
      CLUSTER.forEach((c, i) => U.set(c, 28 + i * 4));
      device.queue.writeBuffer(ubuf, 0, U);
    }

    let dirty = true;
    function render() {
      if (!dirty) return;
      dirty = false;
      writeUniforms();
      const enc = device.createCommandEncoder();
      if (s.caus) {
        enc.clearBuffer(cbuf!);
        const pass = enc.beginComputePass();
        pass.setPipeline(causPipe);
        pass.setBindGroup(0, cBind);
        pass.dispatchWorkgroups(Math.ceil(W / 2 / 8), Math.ceil(H / 2 / 8));
        pass.end();
      }
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      rp.setPipeline(renderPipe);
      rp.setBindGroup(0, rBind);
      rp.draw(3);
      rp.end();
      device.queue.submit([enc.finish()]);
      drawOverlay();
      updateReadouts();
    }

    function drawOverlay() {
      const dpr = stage.dpr;
      g2.setTransform(dpr, 0, 0, dpr, 0, 0);
      g2.clearRect(0, 0, stage.width, stage.height);
      g2.font = '11px Inter, system-ui, sans-serif';
      // lens centre
      const [lx, ly] = toCss(s.lens[0], s.lens[1]);
      g2.strokeStyle = 'rgba(255,220,150,0.8)'; g2.lineWidth = 1.2;
      g2.beginPath(); g2.moveTo(lx - 7, ly); g2.lineTo(lx + 7, ly); g2.moveTo(lx, ly - 7); g2.lineTo(lx, ly + 7); g2.stroke();
      // true (unlensed) source position
      const [sx, sy] = toCss(s.src[0], s.src[1]);
      g2.strokeStyle = 'rgba(120,255,170,0.9)';
      g2.setLineDash([3, 3]);
      g2.beginPath(); g2.arc(sx, sy, 9, 0, Math.PI * 2); g2.stroke();
      g2.setLineDash([]);
      g2.fillStyle = 'rgba(200,255,220,0.9)';
      g2.fillText('source (true position)', sx + 12, sy - 8);
      // scale bar: 1 unit
      const [k, lab] = UNIT[s.model];
      const px = stage.height / viewH;
      g2.fillStyle = 'rgba(255,255,255,0.85)'; g2.fillRect(14, stage.height - 18, px, 2);
      g2.fillText(`${k}${lab}`, 14, stage.height - 24);
      // legend
      let y = 18;
      const leg = (on: boolean, c: string, t: string) => { if (!on) return; g2.fillStyle = c; g2.fillRect(14, y - 4, 10, 3); g2.fillStyle = 'rgba(255,255,255,0.85)'; g2.fillText(t, 30, y); y += 16; };
      leg(s.crit, 'rgb(255,90,90)', 'critical curve (image plane)');
      leg(s.caus, 'rgb(90,255,150)', 'caustic (source plane)');
      if (s.mag) { leg(true, 'rgb(255,115,50)', 'μ > 0 (even parity)'); leg(true, 'rgb(64,140,255)', 'μ < 0 (odd parity)'); }
      void pal;
    }

    const loop = new Loop(null, render);
    stage.onResize(() => {
      over.width = Math.round(stage.width * stage.dpr); over.height = Math.round(stage.height * stage.dpr);
      allocate(); dirty = true; loop.invalidate();
    });

    // ---- pointer: drag the source (near its marker) or the lens (anywhere else)
    let dragging: 'src' | 'lens' | null = null;
    let last: [number, number] = [0, 0];
    over.addEventListener('pointerdown', (e) => {
      const r = over.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const [sx, sy] = toCss(s.src[0], s.src[1]);
      dragging = Math.hypot(x - sx, y - sy) < 22 ? 'src' : 'lens';
      last = toUnits(x, y);
      over.setPointerCapture(e.pointerId);
      over.style.cursor = 'grabbing';
    });
    over.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = over.getBoundingClientRect();
      const p = toUnits(e.clientX - r.left, e.clientY - r.top);
      const t = dragging === 'src' ? s.src : s.lens;
      t[0] += p[0] - last[0]; t[1] += p[1] - last[1];
      last = p; dirty = true;
    });
    const up = () => { dragging = null; over.style.cursor = 'grab'; };
    over.addEventListener('pointerup', up);
    over.addEventListener('pointercancel', up);

    // ---- controls
    const panel = new Panel(host);
    const set = () => { dirty = true; syncVisibility(); };
    const modelSel = panel.select<Model>('Lens', [
      { value: 'point', label: 'Point mass' }, { value: 'sis', label: 'SIS' },
      { value: 'sie', label: 'SIE + shear' }, { value: 'cluster', label: 'Cluster (NFW + galaxies)' },
    ], s.model, (v) => { s.model = v; set(); });
    const Esl = panel.slider('θ_E / mass', { min: 0.2, max: 2.2, value: s.E, step: 0.01 }, (v) => { s.E = v; set(); });
    const qsl = panel.slider('Axis ratio q', { min: 0.3, max: 1, value: s.q, step: 0.01 }, (v) => { s.q = v; set(); });
    const gsl = panel.slider('Ext. shear γ', { min: 0, max: 0.3, value: s.gamma, step: 0.005 }, (v) => { s.gamma = v; set(); });
    const srcSel = panel.select('Source', [
      { value: '0', label: 'Spiral galaxy' }, { value: '1', label: 'Compact (quasar)' }, { value: '2', label: 'Field only' },
    ], String(s.srcType), (v) => { s.srcType = +v; set(); });
    const sz = panel.slider('Source size', { min: 0.03, max: 1, value: s.srcSize, log: true }, (v) => { s.srcSize = v; set(); });
    panel.toggle('Critical curves', s.crit, (v) => { s.crit = v; set(); });
    panel.toggle('Caustics', s.caus, (v) => { s.caus = v; set(); });
    panel.toggle('Magnification map', s.mag, (v) => { s.mag = v; set(); });
    panel.select('Rays / pixel', [{ value: '1', label: '1' }, { value: '2', label: '4' }, { value: '3', label: '9' }], String(s.ss), (v) => { s.ss = +v; set(); });
    const preset = (f: () => void) => () => { f(); modelSel.set(s.model); Esl.set(s.E); qsl.set(s.q); gsl.set(s.gamma); srcSel.set(String(s.srcType)); sz.set(s.srcSize); set(); };
    panel.button('Einstein ring', preset(() => { Object.assign(s, { model: 'sis', E: 1.2, gamma: 0, srcType: 0, srcSize: 0.3 }); s.lens = [0, 0]; s.src = [0.02, 0.0]; }));
    panel.button('Einstein cross', preset(() => { Object.assign(s, { model: 'sie', E: 1.2, q: 0.6, phi: 0.5, gamma: 0.05, srcType: 1, srcSize: 0.25 }); s.lens = [0, 0]; s.src = [0.06, 0.05]; }));
    panel.button('Giant arcs', preset(() => { Object.assign(s, { model: 'cluster', E: 1.4, q: 0.85, gamma: 0.02, srcType: 0, srcSize: 0.25 }); s.lens = [0, 0]; s.src = [0.55, 0.6]; }));
    const ro = panel.readout('');
    function syncVisibility() {
      qsl.el.style.display = s.model === 'sie' || s.model === 'cluster' ? '' : 'none';
      gsl.el.style.display = s.model === 'point' ? 'none' : '';
    }
    syncVisibility();
    function updateReadouts() {
      const [k, lab] = UNIT[s.model];
      const beta = Math.hypot(s.src[0] - s.lens[0], s.src[1] - s.lens[1]);
      ro.set(s.model === 'cluster' ? `source offset β = ${fmt(beta * k, 2)}${lab}` : `θ_E = ${fmt(s.E * k, 2)}${lab} · β = ${fmt(beta * k, 2)}${lab} · u = β/θ_E = ${fmt(beta / s.E, 2)}`);
    }

    // redraw while dragging / after changes; the loop is cheap when not dirty
    return {
      setVisible: (v) => { if (v) dirty = true; loop.setVisible(v); },
      destroy: () => { loop.destroy(); cbuf?.destroy(); ubuf.destroy(); },
    };
  },
});
