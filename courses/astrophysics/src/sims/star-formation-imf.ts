// Chapter 7 figure: sample N stars from the Kroupa IMF and histogram them per dex of mass,
// either by number (dN/dlog M) or by mass (dM/dlog M), with analytic Kroupa / Salpeter / Chabrier curves.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { kroupa, salpeter, chabrierLog, sampleKroupa, IMF_MIN, IMF_MAX } from './star-formation/physics';

const NBIN = 36;
const LMIN = Math.log10(IMF_MIN), LMAX = Math.log10(IMF_MAX), DL = (LMAX - LMIN) / NBIN;

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1 : 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: IMF_MIN, max: IMF_MAX, log: true, label: 'stellar mass M (M☉)' },
      y: { min: 0.5, max: 1e6, log: true, label: 'stars per dex' },
    });
    let N = 10000, byMass = false, seed = 7;
    const counts = new Float64Array(NBIN), mass = new Float64Array(NBIN);
    let totM = 0, maxM = 0, nBD = 0, nOB = 0, mOB = 0, mBelow1 = 0;

    function draw() {
      let s = seed++ >>> 0;
      const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      counts.fill(0); mass.fill(0); totM = 0; maxM = 0; nBD = 0; nOB = 0; mOB = 0; mBelow1 = 0;
      for (let i = 0; i < N; i++) {
        const M = sampleKroupa(rnd(), rnd());
        const b = Math.min(NBIN - 1, Math.floor((Math.log10(M) - LMIN) / DL));
        counts[b]++; mass[b] += M; totM += M; maxM = Math.max(maxM, M);
        if (M < 0.075) nBD++;
        if (M > 8) { nOB++; mOB += M; }
        if (M < 1) mBelow1 += M;
      }
    }

    function render() {
      const scale = byMass ? totM / N : 1;
      plot.o.y.label = byMass ? 'mass per dex (M☉)' : 'stars per dex';
      plot.o.y.max = Math.max(10, 10 ** Math.ceil(Math.log10(N * (byMass ? 0.4 : 0.6) / DL + 1)));
      plot.o.y.min = byMass ? 0.05 : 0.5;
      plot.draw(() => {
        const { ctx } = plot;
        const y0 = plot.m.t + plot.ph;
        for (let b = 0; b < NBIN; b++) {
          const v = (byMass ? mass[b] : counts[b]) / DL;
          if (v <= 0) continue;
          const x0 = plot.px(10 ** (LMIN + b * DL)), x1 = plot.px(10 ** (LMIN + (b + 1) * DL));
          const y = plot.py(Math.max(v, plot.o.y.min));
          ctx.fillStyle = 10 ** (LMIN + (b + 0.5) * DL) < 0.075 ? pal.series[3] : pal.series[0];
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x0 + 0.5, y, x1 - x0 - 1, y0 - y);
          ctx.globalAlpha = 1;
        }
        const perDex = (f: (m: number) => number) => (M: number) => N * f(M) * M * Math.LN10 * (byMass ? M : 1);
        const kr = perDex(kroupa);
        const sal1 = kroupa(1) / salpeter(1);
        plot.fn(kr, { color: pal.accent, width: 2 });
        plot.fn((M) => (M >= 0.1 ? perDex(salpeter)(M) * sal1 : NaN), { color: pal.series[2], dash: [5, 4] });
        const ch1 = kroupa(1) * Math.LN10 / chabrierLog(1);
        plot.fn((M) => N * chabrierLog(M) * ch1 * (byMass ? M : 1), { color: pal.series[1], dash: [2, 3] });
        plot.vline(0.075, { label: 'H-burning limit', color: pal.muted });
        plot.vline(8, { label: '→ supernovae', color: pal.muted });
        void scale;
      });
      const { ctx } = plot;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      const xr = plot.m.l + plot.pw - 8;
      [[pal.accent, 'Kroupa (2001)'], [pal.series[2], 'Salpeter (1955), α = 2.35'], [pal.series[1], 'Chabrier (2003)'], [pal.series[3], 'brown dwarfs (sampled)']].forEach(([c, t], i) => {
        ctx.fillStyle = c; ctx.fillRect(xr - ctx.measureText(t).width - 16, plot.m.t + 30 + i * 15 + 4, 10, 3);
        ctx.fillStyle = pal.fg; ctx.fillText(t, xr, plot.m.t + 30 + i * 15);
      });
      readM.set(`${fmt(totM, 3)} M☉ (mean ${fmt(totM / N, 2)})`);
      readMax.set(`${fmt(maxM, 3)} M☉`);
      readBD.set(`${(100 * nBD / N).toFixed(1)}% of objects`);
      readOB.set(`${nOB} stars (${(100 * nOB / N).toFixed(2)}%) hold ${(100 * mOB / totM).toFixed(0)}% of the mass`);
      readLow.set(`${(100 * mBelow1 / totM).toFixed(0)}% of the mass`);
    }

    const loop = new Loop(null, render);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onDestroy(onThemeChange(() => { pal = palette(); loop.invalidate(); }));

    const panel = new Panel(host);
    panel.slider('Stars N', { min: 100, max: 1e6, value: N, log: true, step: 1, format: (v) => fmt(Math.round(v), 3) }, (v) => { N = Math.round(v); draw(); loop.invalidate(); });
    panel.button('Draw again', () => { draw(); loop.invalidate(); }, true);
    panel.toggle('Weight by mass', byMass, (v) => { byMass = v; loop.invalidate(); });
    const readM = panel.readout('Total');
    const readMax = panel.readout('Most massive');
    const readBD = panel.readout('Brown dwarfs');
    const readOB = panel.readout('M > 8 M☉:');
    const readLow = panel.readout('Stars < 1 M☉ hold');
    draw();
    return { setVisible: (v) => { loop.setVisible(v); loop.invalidate(); }, destroy: () => loop.destroy() };
  },
});
