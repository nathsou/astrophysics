// Secondary figure: the Tully–Fisher relation (baryonic mass vs flat rotation speed) and the
// radial acceleration relation (RAR: observed g vs the g predicted from baryons alone). Both are
// approximate, illustrative datasets — the point is the tight power-law/one-to-one relations
// themselves, which any successful dark-matter or modified-gravity theory must reproduce.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// Approximate points scattered around the observed relations (illustrative, not a real catalogue).
function seeded(n: number, seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    let mode: 'btf' | 'rar' = 'btf';
    const stage = createStage(host, { aspect: 16 / 9 });

    const rnd = seeded(1, 42);
    const N = 45;
    const logMb: number[] = [], logV: number[] = [];
    for (let i = 0; i < N; i++) {
      const lv = 1.6 + rnd() * 1.1; // log10 v_flat, km/s
      const lm = 1.7 + 3.6 * lv + (rnd() - 0.5) * 0.35; // Baryonic TF slope ~3.6-4
      logV.push(lv); logMb.push(lm);
    }
    const gN: number[] = [], gObs: number[] = [];
    const a0 = 1.2e-10; // m/s^2, MOND/RAR acceleration scale
    for (let i = 0; i < 60; i++) {
      const lgN = -12 + rnd() * 4;
      const gn = 10 ** lgN;
      const g = (gn + Math.sqrt(gn * gn + 4 * gn * a0)) / 2;
      gN.push(gn); gObs.push(g * (1 + (rnd() - 0.5) * 0.25));
    }

    const plotBTF = new Plot(stage.canvas, {
      x: { min: 1.4, max: 2.8, label: 'log₁₀ v_flat (km/s)' },
      y: { min: 8, max: 12, label: 'log₁₀ M_baryon (M☉)' },
      title: 'Baryonic Tully–Fisher relation',
    });
    const plotRAR = new Plot(stage.canvas, {
      x: { min: 1e-13, max: 1e-8, log: true, label: 'g_bar (m/s², from baryons)' },
      y: { min: 1e-13, max: 1e-8, log: true, label: 'g_obs (m/s²)' },
      title: 'Radial acceleration relation',
    });

    const loop = new Loop(null, render, 1 / 30);

    loop.onDemand = true;

    function render() {
      const { width: W, height: H, dpr } = stage;
      const plot = mode === 'btf' ? plotBTF : plotRAR;
      plot.resize(W, H, dpr);
      plot.draw(() => {
        if (mode === 'btf') {
          plot.scatter(logV, logMb, { color: pal.accent, size: 4 });
          plot.fn((lv) => 1.7 + 3.6 * lv, { color: pal.fg, dash: [4, 3], width: 1.5 });
          plot.text('M_b ∝ v⁴ (slope ≈ 3.6–4)', plot.m.l + 12, plot.m.t + 16, { color: pal.muted });
        } else {
          plot.scatter(gN, gObs, { color: pal.accent, size: 3.5 });
          plot.fn((g) => g, { color: pal.fg, dash: [2, 3], width: 1.2 });
          plot.text('dashed: g_obs = g_bar (no dark matter)', plot.m.l + 12, plot.m.t + 16, { color: pal.muted });
        }
      });
    }

    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    panel.select('Relation', [{ value: 'btf', label: 'Baryonic Tully–Fisher' }, { value: 'rar', label: 'Radial acceleration (RAR)' }], mode, (v) => { mode = v as any; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
