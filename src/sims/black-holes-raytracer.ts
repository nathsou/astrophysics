// Chapter 19 flagship: real-time Schwarzschild ray tracer (WebGPU fragment shader).
// Units: r_s = 1, c = 1. Every pixel integrates its own null geodesic backwards from the camera
// (RK4 on the Cartesian Binet equation), shading an accretion disk it crosses and the lensed sky it escapes to.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { OrbitCamera } from '../lib/runtime/camera';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { blackbodyRGB } from '../lib/physics/blackbody';
import shader from './black-holes/raytrace.wgsl?raw';

type Quality = 'low' | 'med' | 'high';
const QUALITY: Record<Quality, { res: number; steps: number; k: number; label: string }> = {
  low: { res: 0.5, steps: 180, k: 0.12, label: 'Low (fast)' },
  med: { res: 0.8, steps: 300, k: 0.07, label: 'Medium' },
  high: { res: 1.3, steps: 500, k: 0.04, label: 'High' },
};

const R_IN = 3; // ISCO in units of r_s
const R_OUT = 14;
const B_CRIT = Math.sqrt(27) / 2; // critical impact parameter in r_s

/** 256-entry LUT of blackbody chromaticity in *linear* RGB, normalised to unit luminance. */
function blackbodyLUT(): Float32Array {
  const lut = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const T = Math.exp(Math.log(1000) + (i / 255) * (Math.log(40000) - Math.log(1000)));
    const [r, g, b] = blackbodyRGB(T).map((c) => Math.pow(c, 2.2));
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b || 1;
    lut.set([r / Y, g / Y, b / Y, 1], i * 4);
  }
  return lut;
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    stage.el.style.background = '#000';
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    const module = device.createShaderModule({ code: shader, label: 'black-holes-raytracer' });
    if (import.meta.env.DEV) {
      module.getCompilationInfo().then((info) => {
        for (const m of info.messages) console[m.type === 'error' ? 'error' : 'warn'](`[black-holes-raytracer] ${m.lineNum}:${m.linePos} ${m.message}`);
      });
    }
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const ubo = device.createBuffer({ size: 9 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const lutBuf = device.createBuffer({ size: 256 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(lutBuf, 0, blackbodyLUT());
    const bind = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: { buffer: lutBuf } }],
    });
    onDestroy(() => { ubo.destroy(); lutBuf.destroy(); });

    // Peak of F ∝ r⁻³(1 − √(r_in/r)) is at r = (49/36) r_in.
    const rPk = (49 / 36) * R_IN;
    const Fmax = (1 - Math.sqrt(R_IN / rPk)) / rPk ** 3;

    const cam = new OrbitCamera(stage.canvas, {
      distance: +(params.distance ?? 24), minDistance: 2.5, maxDistance: 60,
      pitch: (Math.PI / 180) * (90 - +(params.inclination ?? 82)), yaw: -Math.PI / 2, fov: (38 * Math.PI) / 180,
      autoRotate: 0.02,
    });

    const s = {
      quality: 'med' as Quality,
      Tpeak: 9000,
      lensing: true, disk: true, doppler: true, gravz: true, grid: false, stars: true, galaxy: false,
      time: 0,
    };
    const u = new Float32Array(36);

    let res = QUALITY[s.quality].res;
    const applyRes = () => {
      stage.canvas.width = Math.max(1, Math.round(stage.width * res));
      stage.canvas.height = Math.max(1, Math.round(stage.height * res));
    };

    let fpsEMA = 0, lastT = performance.now();
    const loop = new Loop(null, (_a, frameDt) => {
      s.time += frameDt;
      cam.update(frameDt);
      syncSliders();
      const eye = cam.eye;
      const d = Math.hypot(...eye);
      const fwd = eye.map((x) => -x / d);
      let rx = fwd[1], ry = -fwd[0];
      const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
      const up = [ry * fwd[2], -rx * fwd[2], rx * fwd[1] - ry * fwd[0]];
      const q = QUALITY[s.quality];
      u.set([...eye, Math.tan(cam.fov / 2)], 0);
      u.set([rx, ry, 0, stage.width / stage.height], 4);
      u.set([...up, s.time], 8);
      u.set([...fwd, q.steps], 12);
      u.set([q.k, s.Tpeak, 1.15, Math.max(d * 1.001, 60)], 16);
      u.set([R_IN, R_OUT, Fmax, d], 20);
      u.set([-eye[0] / d, -eye[1] / d, -eye[2] / d, s.galaxy ? 1 : 0], 24);
      u.set([+s.lensing, +s.disk, +s.doppler, +s.gravz], 28);
      u.set([+s.grid, +s.stars, 0, 0], 32);
      device.queue.writeBuffer(ubo, 0, u);

      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);

      const now = performance.now();
      const dt = (now - lastT) / 1000; lastT = now;
      if (dt > 0 && dt < 0.5) fpsEMA = fpsEMA ? fpsEMA * 0.92 + 0.08 / dt : 1 / dt;
      const shadow = (Math.asin(Math.min(1, (B_CRIT / d) * Math.sqrt(1 - 1 / d))) * 180) / Math.PI;
      shadowOut.set(`${fmt(shadow, 3)}° (b = ${fmt(B_CRIT, 3)} r_s)`);
      perfOut.set(`${stage.canvas.width}×${stage.canvas.height} · ${loop.paused ? 'paused' : `${Math.round(fpsEMA)} fps`}`);
      if (loop.paused) lastT = 0;
    });
    cam.onChange = () => loop.invalidate();
    stage.onResize(() => { applyRes(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => { loop.paused = p; loop.invalidate(); });
    panel.select('Quality', (Object.keys(QUALITY) as Quality[]).map((k) => ({ value: k, label: QUALITY[k].label })), s.quality, (v) => {
      s.quality = v; res = QUALITY[v].res; applyRes(); loop.invalidate();
    });
    const distS = panel.slider('Distance', { min: 2.5, max: 60, value: cam.distance, log: true, unit: 'r_s' }, (v) => { cam.distance = v; loop.invalidate(); });
    const incS = panel.slider('Inclination', { min: 2, max: 178, value: 90 - (cam.pitch * 180) / Math.PI, step: 1, unit: '°', format: (v) => String(Math.round(v)) }, (v) => {
      cam.pitch = ((90 - v) * Math.PI) / 180; loop.invalidate();
    });
    panel.slider('Disk T_peak', { min: 2500, max: 30000, value: s.Tpeak, log: true, step: 100, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => { s.Tpeak = v; loop.invalidate(); });
    const tog = (label: string, key: 'lensing' | 'disk' | 'doppler' | 'gravz' | 'grid' | 'stars' | 'galaxy') =>
      panel.toggle(label, s[key], (v) => { s[key] = v; loop.invalidate(); });
    tog('Lensing', 'lensing');
    tog('Disk', 'disk');
    tog('Doppler beaming', 'doppler');
    tog('Grav. redshift', 'gravz');
    tog('Grid sky', 'grid');
    tog('Galaxy behind hole', 'galaxy');
    const shadowOut = panel.readout('Shadow radius');
    const perfOut = panel.readout('Render');

    function syncSliders() {
      if (Math.abs(distS.get() - cam.distance) > 1e-6) distS.set(cam.distance);
      const inc = 90 - (cam.pitch * 180) / Math.PI;
      if (Math.abs(incS.get() - inc) > 0.5) incS.set(Math.round(inc));
    }

    return { setVisible: (v) => { lastT = performance.now(); loop.setVisible(v); }, destroy: () => loop.destroy() };
  },
});
