// Chapter 26 flagship: live Big Bang Nucleosynthesis network.
// Left: abundances Y_i(t) animating as the reduced network (n,p,D,T,He3,He4,Li7) is integrated
// with a stiff implicit solver from t=0.01s to t=30min, with timeline markers for freeze-out,
// the deuterium bottleneck and helium formation. Right: a Schramm plot — final abundances vs eta,
// computed progressively on a grid with the same solver, with approximate observational bands.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { integrateBBN, finalAbundances, type RunPoint } from './big-bang/bbn-network';

const T0 = 0.01, T1 = 1800; // seconds
const ETA0 = 6.1e-10;

const SP_LABEL = ['n', 'p', 'D', 'T', '³He', '⁴He', '⁷Li'];
const SP_COLOR = [3, 2, 0, 4, 1, 0, 1]; // palette.series index reused with different alpha where needed

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:0;';
    host.append(wrap);
    const leftStage = createStage(wrap, { aspect: 4 / 3 });
    const rightStage = createStage(wrap, { aspect: 4 / 3.4 });
    leftStage.el.style.borderRight = '1px solid var(--rule)';

    const plotAbund = new Plot(leftStage.canvas, {
      x: { min: 0.01, max: 1800, log: true, label: 't (s)' },
      y: { min: 1e-12, max: 2, log: true, label: 'Y = n_i / n_baryon' },
      title: 'Abundances vs time',
    });
    const plotSchramm = new Plot(rightStage.canvas, {
      x: { min: 1e-11, max: 1e-8, log: true, label: 'η (baryon-to-photon)' },
      y: { min: 1e-11, max: 1, log: true, label: 'abundance' },
      title: 'Schramm plot (final abundances vs η)',
    });

    let eta = ETA0;
    let Neff = 3.046;
    let run: RunPoint[] = [];
    let animT = T0; // current animated time (s), advances in log
    let done = false;

    function recompute() {
      run = integrateBBN(T0, T1, { eta, Neff }, 320);
      animT = T0;
      done = false;
    }
    recompute();

    // Schramm plot grid, computed progressively (a few η values per frame while visible)
    const NGRID = 36;
    const etaGrid = Array.from({ length: NGRID }, (_, i) => 1e-11 * (1e-8 / 1e-11) ** (i / (NGRID - 1)));
    let gridResults: ({ Yp: number; DtoH: number; He3toH: number; Li7toH: number } | null)[] = etaGrid.map(() => null);
    let gridIdx = 0;

    function stepGrid() {
      if (gridIdx >= NGRID) return;
      const n = Math.min(3, NGRID - gridIdx);
      for (let k = 0; k < n; k++) {
        gridResults[gridIdx] = finalAbundances({ eta: etaGrid[gridIdx], Neff });
        gridIdx++;
      }
    }

    function findAtTime(t: number): RunPoint {
      let lo = 0, hi = run.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (run[mid].t < t) lo = mid; else hi = mid; }
      return run[hi];
    }

    const loop = new Loop((dt) => {
      if (!done) {
        animT *= Math.pow(T1 / T0, dt * 0.09); // ~11s to sweep the full log range
        if (animT >= T1) { animT = T1; done = true; }
      }
      stepGrid();
    }, render, 1 / 30);

    function render() {
      const point = findAtTime(animT);
      plotAbund.draw(() => {
        // full traces, faint
        for (let i = 0; i < 7; i++) {
          const xs = run.map((r) => r.t);
          const ys = run.map((r) => Math.max(r.Y[i], 1e-13));
          plotAbund.line(xs, ys, { color: pal.series[SP_COLOR[i] % 5], alpha: 0.28, width: 1.5 });
        }
        // freeze-out marker
        plotAbund.vline(1.0, { color: pal.muted, label: 'n/p freeze-out' });
        plotAbund.vline(180, { color: pal.muted, label: 'D bottleneck breaks' });
        // moving time cursor
        plotAbund.vline(point.t, { color: pal.accent, width: 2, dash: [] });
        for (let i = 0; i < 7; i++) {
          plotAbund.point(point.t, Math.max(point.Y[i], 1e-13), { color: pal.series[SP_COLOR[i] % 5], r: 4 });
        }
      });
      // legend
      const { ctx } = plotAbund;
      ctx.font = '11px Inter, system-ui, sans-serif';
      SP_LABEL.forEach((l, i) => {
        ctx.fillStyle = pal.series[SP_COLOR[i] % 5];
        ctx.fillRect(plotAbund.m.l + 4, 8 + i * 13, 9, 3);
        ctx.fillStyle = pal.fg;
        ctx.fillText(l, plotAbund.m.l + 17, 12 + i * 13);
      });
      ctx.fillStyle = pal.muted;
      ctx.fillText(`t = ${fmt(point.t, 3)} s   T = ${fmt(point.T * 1000, 3)} keV`, plotAbund.m.l + 4, plotAbund.ph + plotAbund.m.t - 6);

      plotSchramm.draw(() => {
        const xs: number[] = [], yD: number[] = [], yHe3: number[] = [], yLi: number[] = [], yYp: number[] = [];
        for (let i = 0; i < NGRID; i++) {
          if (!gridResults[i]) continue;
          xs.push(etaGrid[i]);
          yD.push(Math.max(gridResults[i]!.DtoH, 1e-12));
          yHe3.push(Math.max(gridResults[i]!.He3toH, 1e-12));
          yLi.push(Math.max(gridResults[i]!.Li7toH, 1e-13));
          yYp.push(Math.max(gridResults[i]!.Yp, 1e-3));
        }
        // approximate observational bands (illustrative widths, not exact fit intervals)
        const { ctx: c2 } = plotSchramm;
        c2.save();
        c2.globalAlpha = 0.12;
        c2.fillStyle = pal.good;
        const yb = (v: number) => plotSchramm.py(v);
        c2.fillRect(plotSchramm.m.l, yb(3.0e-5), plotSchramm.pw, yb(2.2e-5) - yb(3.0e-5)); // D/H band
        c2.restore();

        plotSchramm.line(xs, yD, { color: pal.series[0] });
        plotSchramm.line(xs, yHe3, { color: pal.series[1] });
        plotSchramm.line(xs, yLi, { color: pal.series[2] });
        plotSchramm.line(xs, yYp.map((v) => v / 10), { color: pal.series[3] }); // Yp scaled onto same log decade for display
        plotSchramm.vline(eta, { color: pal.accent2, width: 2 });
      });
      const { ctx: c3 } = plotSchramm;
      c3.font = '11px Inter, system-ui, sans-serif';
      const legend = [['D/H', 0], ['³He/H', 1], ['⁷Li/H', 2], ['Y_p /10', 3]] as [string, number][];
      legend.forEach(([l, i], k) => {
        c3.fillStyle = pal.series[i];
        c3.fillRect(plotSchramm.m.l + 4, 8 + k * 13, 9, 3);
        c3.fillStyle = pal.fg;
        c3.fillText(l, plotSchramm.m.l + 17, 12 + k * 13);
      });
    }

    leftStage.onResize((w, h, d) => { plotAbund.resize(w, h, d); loop.invalidate(); });
    rightStage.onResize((w, h, d) => { plotSchramm.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Replay', () => { animT = T0; done = false; loop.invalidate(); });
    const ro = panel.readout('Y_p (⁴He mass fraction):');
    const roD = panel.readout('D/H:');
    const updateReadouts = () => {
      const f = finalAbundances({ eta, Neff }, 1800);
      ro.set(fmt(f.Yp, 4));
      roD.set(fmt(f.DtoH, 3));
    };
    panel.slider('η (×10⁻¹⁰)', { min: 1, max: 90, value: eta * 1e10, step: 0.1 }, (v) => {
      eta = v * 1e-10; recompute(); updateReadouts(); loop.invalidate();
    });
    panel.slider('N_eff', { min: 2, max: 5, value: Neff, step: 0.05 }, (v) => {
      Neff = v; recompute(); updateReadouts(); loop.invalidate();
    });
    updateReadouts();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
