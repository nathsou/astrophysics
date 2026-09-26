// Appendix A1: error propagation for power-law formulas, f = Π x_i^{n_i}.
// Linear ("first-order") propagation predicts σ_f/f = sqrt(Σ (n_i σ_i/x_i)²). A Monte Carlo run
// (Gaussian inputs, 40k draws) shows the real distribution, which skews once errors get large.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Input { sym: string; name: string; n: number; sigma: number }
interface Formula { label: string; out: string; tex: string; inputs: Input[] }

const FORMULAS: Record<string, Formula> = {
  kepler: {
    label: 'Mass from an orbit: M ∝ a³/P²', out: 'M', tex: 'M ∝ a³ P⁻²',
    inputs: [{ sym: 'a', name: 'orbit size a', n: 3, sigma: 0.05 }, { sym: 'P', name: 'period P', n: -2, sigma: 0.01 }],
  },
  lum: {
    label: 'Luminosity: L ∝ R²T⁴', out: 'L', tex: 'L ∝ R² T⁴',
    inputs: [{ sym: 'R', name: 'radius R', n: 2, sigma: 0.1 }, { sym: 'T', name: 'temperature T', n: 4, sigma: 0.1 }],
  },
  transit: {
    label: 'Planet radius from a transit: Rp = R*·√depth', out: 'Rp', tex: 'Rₚ ∝ R* δ^½',
    inputs: [{ sym: 'R*', name: 'star radius R*', n: 1, sigma: 0.05 }, { sym: 'δ', name: 'transit depth δ', n: 0.5, sigma: 0.1 }],
  },
  parallax: {
    label: 'Distance from parallax: d = 1/p', out: 'd', tex: 'd ∝ p⁻¹',
    inputs: [{ sym: 'p', name: 'parallax p', n: -1, sigma: 0.2 }],
  },
};

const N = 40000;
const BINS = 90;
const XMAX = 3;

// Standard normal deviates (Box–Muller), regenerated only when the formula changes.
function gauss(out: Float64Array) {
  for (let i = 0; i < out.length; i += 2) {
    const u = 1 - Math.random(), v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < out.length) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let key = 'lum';
    const z = [new Float64Array(N), new Float64Array(N)];
    z.forEach(gauss);
    const hist = new Float64Array(BINS);
    const vals = new Float64Array(N);
    let sigLin = 0, bad = 0, p16 = 0, p50 = 0, p84 = 0;

    const stage = createStage(host, { aspect: 16 / 8 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: XMAX, label: 'result ÷ true value' },
      y: { min: 0, max: 1, label: 'probability density', format: () => '' },
      margin: { l: 36, r: 16, t: 28, b: 42 },
    });
    const loop = new Loop(null, render);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    function simulate() {
      const f = FORMULAS[key];
      hist.fill(0);
      bad = 0;
      let good = 0;
      for (let k = 0; k < N; k++) {
        let v = 1;
        for (let j = 0; j < f.inputs.length; j++) {
          const x = 1 + f.inputs[j].sigma * z[j][k];
          if (x <= 0) { v = NaN; break; } // unphysical draw (e.g. negative parallax)
          v *= Math.pow(x, f.inputs[j].n);
        }
        if (!Number.isFinite(v)) { bad++; continue; }
        vals[good++] = v;
        const b = Math.floor((v / XMAX) * BINS);
        if (b >= 0 && b < BINS) hist[b]++;
      }
      const sorted = vals.subarray(0, good).slice().sort();
      const q = (p: number) => sorted[Math.min(good - 1, Math.floor(p * good))];
      p16 = q(0.1587); p50 = q(0.5); p84 = q(0.8413);
      const norm = N * (XMAX / BINS);
      let mx = 0;
      for (let b = 0; b < BINS; b++) { hist[b] /= norm; mx = Math.max(mx, hist[b]); }
      sigLin = Math.sqrt(f.inputs.reduce((s, i) => s + (i.n * i.sigma) ** 2, 0));
      const gpk = 1 / (Math.sqrt(2 * Math.PI) * Math.max(sigLin, 1e-3));
      plot.o.y.max = Math.max(mx, Math.min(gpk, mx * 1.6)) * 1.15;
    }

    function render() {
      const f = FORMULAS[key];
      plot.draw(() => {
        const { ctx } = plot;
        const w = XMAX / BINS;
        ctx.fillStyle = pal.series[1];
        ctx.globalAlpha = 0.55;
        for (let b = 0; b < BINS; b++) {
          const x0 = plot.px(b * w), x1 = plot.px((b + 1) * w), y = plot.py(hist[b]);
          ctx.fillRect(x0, y, Math.max(1, x1 - x0 - 0.5), plot.py(0) - y);
        }
        ctx.globalAlpha = 1;
        const s = Math.max(sigLin, 1e-3);
        plot.fn((x) => Math.exp(-0.5 * ((x - 1) / s) ** 2) / (Math.sqrt(2 * Math.PI) * s), { color: pal.accent, width: 2 });
        plot.vline(1, { color: pal.fg, label: 'truth' });
        plot.vline(p50, { color: pal.series[1], dash: [2, 3] });
      });
      // Error budget bar: share of the variance from each input.
      const { ctx } = plot;
      const tot = f.inputs.reduce((s, i) => s + (i.n * i.sigma) ** 2, 0) || 1;
      const X0 = plot.m.l + plot.pw * 0.55, BW = plot.pw * 0.43, Y0 = plot.m.t + 6;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillStyle = pal.muted;
      ctx.fillText('where the error comes from', X0, Y0 - 1);
      let x = X0;
      f.inputs.forEach((inp, j) => {
        const share = (inp.n * inp.sigma) ** 2 / tot;
        ctx.fillStyle = pal.series[j === 0 ? 2 : 3];
        ctx.fillRect(x, Y0 + 2, BW * share, 12);
        if (share > 0.12) {
          ctx.fillStyle = pal.bg;
          ctx.textBaseline = 'middle';
          ctx.fillText(`${inp.sym} ${Math.round(share * 100)}%`, x + 4, Y0 + 8.5);
          ctx.textBaseline = 'bottom';
        }
        x += BW * share;
      });
      plot.text(`${f.tex}`, plot.m.l + 6, plot.m.t + 16, { color: pal.fg, size: 12 });
      plot.text('━ linear propagation   ▮ Monte Carlo', plot.m.l + 6, plot.m.t + 32, { color: pal.muted });

      rLin.set(`±${fmt(sigLin * 100, 3)}%`);
      rMc.set(`${fmt(p50, 3)} (−${fmt((p50 - p16) * 100, 2)}% / +${fmt((p84 - p50) * 100, 2)}%)`);
      rBad.el.style.display = bad ? '' : 'none';
      rBad.set(`${fmt((bad / N) * 100, 2)}% of draws`);
    }

    const panel = new Panel(host);
    const sliders: ReturnType<Panel['slider']>[] = [];
    let sliderBox: HTMLDivElement | null = null;
    panel.select('Formula', Object.entries(FORMULAS).map(([k, f]) => ({ value: k, label: f.label })), key, (v) => { key = v; build(); });
    const rLin = panel.readout('Linear estimate:');
    const rMc = panel.readout('Monte Carlo median & 68% range:');
    const rBad = panel.readout('Unphysical (p ≤ 0):');

    function build() {
      sliderBox?.remove();
      sliders.length = 0;
      const p = new Panel(host);
      sliderBox = p.el;
      for (const inp of FORMULAS[key].inputs) {
        sliders.push(p.slider(`σ of ${inp.name}`, { min: 0, max: 0.6, value: inp.sigma, step: 0.005, format: (v) => `${fmt(v * 100, 2)}%` }, (v) => {
          inp.sigma = v; simulate(); loop.invalidate();
        }));
      }
      p.readout(`power of each input: ${FORMULAS[key].inputs.map((i) => `${i.sym}: ${i.n}`).join(', ')}`);
      simulate();
      loop.invalidate();
    }
    build();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
