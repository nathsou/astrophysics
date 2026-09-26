// Chapter 8: radial drift speed of solids vs size in an MMSN-like gas disk.
// Drift peaks at Stokes number St = 1 (the "metre-size barrier"); fragmentation and bouncing
// limits are overlaid. All curves are analytic (disk-model.ts).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { stokes, driftSpeed, sizeForStokes, soundSpeed, temperature, snowLine, AU_CM, YR_S, type Disk } from './planet-formation/disk-model';

const fmtSize = (s: number) =>
  s < 1e-2 ? `${fmt(s * 1e4, 2)} µm` : s < 1 ? `${fmt(s * 10, 2)} mm` : s < 100 ? `${fmt(s, 2)} cm` : s < 1e5 ? `${fmt(s / 100, 2)} m` : `${fmt(s / 1e5, 2)} km`;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1e-4, max: 1e7, log: true, label: 'solid radius s (cm)', format: (v) => fmtSize(v) },
      y: { min: 1e-6, max: 300, log: true, label: 'inward drift speed (m/s)' },
      title: 'Radial drift of solids through a gas disk',
      margin: { l: 58, r: 16, t: 28, b: 42 },
    });
    const disk: Disk = { sigmaScale: 1, L: 1, M: 1 };
    let r = 1, alpha = 1e-3;

    let dirty = true;
    const loop = new Loop(null, render);
    const redraw = () => { dirty = true; loop.invalidate(); };
    stage.onResize((w, h, d) => { plot.resize(w, h, d); redraw(); });
    onThemeChange(() => { pal = palette(); redraw(); });

    function render() {
      if (!dirty) return;
      dirty = false;
      const vfrag = r > snowLine(disk.L) ? 1000 : 100; // cm/s: icy aggregates are stickier
      const cs = soundSpeed(temperature(disk, r));
      const stFrag = (vfrag * vfrag) / (3 * alpha * cs * cs);
      const sFrag = sizeForStokes(disk, r, stFrag);
      const s1 = sizeForStokes(disk, r, 1);
      const vmax = driftSpeed(disk, r, 1) / 100;
      plot.draw(() => {
        const { ctx } = plot;
        // barrier bands
        const band = (a: number, b: number, col: string, label: string) => {
          const x0 = plot.px(a), x1 = plot.px(b);
          ctx.fillStyle = col; ctx.globalAlpha = 0.12;
          ctx.fillRect(x0, plot.m.t, x1 - x0, plot.ph);
          ctx.globalAlpha = 1;
          plot.text(label, (x0 + x1) / 2, plot.m.t + plot.ph - 8, { color: col, align: 'center' });
        };
        band(0.1, 1, pal.accent3, 'bouncing');
        band(s1 / 10, s1 * 10, pal.bad, 'metre barrier');
        if (sFrag < 1e7) plot.vline(sFrag, { color: pal.accent2, label: `fragmentation (v_frag ${vfrag / 100} m/s)` });
        plot.fn((s) => driftSpeed(disk, r, stokes(disk, r, s)) / 100, { color: pal.series[0], width: 2.2, samples: 400 });
        plot.point(s1, vmax, { color: pal.bad, label: `St = 1: ${fmtSize(s1)}, ${fmt(vmax, 3)} m/s` });
        for (const st of [1e-3, 1e-2, 0.1, 10, 100]) {
          const s = sizeForStokes(disk, r, st);
          plot.point(s, driftSpeed(disk, r, st) / 100, { r: 2.5, color: pal.muted, label: `St ${st}` });
        }
      });
      const tDrift = (r * AU_CM) / (vmax * 100) / YR_S;
      rS1.set(fmtSize(s1));
      rV.set(`${fmt(vmax, 3)} m/s`);
      rT.set(`${fmt(tDrift, 3)} yr`);
    }

    const panel = new Panel(host);
    panel.slider('Radius', { min: 0.1, max: 100, value: r, log: true, unit: 'AU' }, (v) => { r = v; redraw(); });
    panel.slider('Gas Σ', { min: 0.1, max: 10, value: 1, log: true, format: (v) => `${fmt(v, 2)}× MMSN` }, (v) => { disk.sigmaScale = v; redraw(); });
    panel.slider('Turbulence α', { min: 1e-5, max: 1e-2, value: alpha, log: true }, (v) => { alpha = v; redraw(); });
    const rS1 = panel.readout('St = 1 at');
    const rV = panel.readout('peak drift');
    const rT = panel.readout('drift time r/v (St = 1)');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
