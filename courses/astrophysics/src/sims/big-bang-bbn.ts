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
type Pal = ReturnType<typeof palette>;
// Seven species, seven distinguishable styles: n dashed grey, p neutral, the rest from the series palette.
const spColor = (pal: Pal, i: number) => [pal.muted, pal.fg, pal.series[1], pal.series[4], pal.series[3], pal.series[0], pal.series[2]][i];
const SP_DASH: (number[] | undefined)[] = [[5, 3], undefined, undefined, undefined, undefined, undefined, undefined];

/** Horizontal legend under a plot title; wraps to more rows when narrow. Returns the rows used. */
function legendRow(ctx: CanvasRenderingContext2D, items: [string, string, number[]?][], x0: number, y0: number, maxX: number, fg: string): number {
  ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let x = x0, y = y0, rows = 1;
  for (const [label, color, dash] of items) {
    const w = 18 + ctx.measureText(label).width + 12;
    if (x + w > maxX && x > x0) { x = x0; y += 15; rows++; }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash ?? []);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = fg;
    ctx.fillText(label, x + 18, y);
    x += w;
  }
  return rows;
}

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
      margin: { l: 56, r: 16, t: 46, b: 42 },
    });
    const plotSchramm = new Plot(rightStage.canvas, {
      x: { min: 1e-11, max: 1e-8, log: true, label: 'η (baryon-to-photon)' },
      y: { min: 1e-11, max: 1, log: true, label: 'abundance' },
      title: 'Schramm plot (final abundances vs η)',
      margin: { l: 56, r: 16, t: 46, b: 42 },
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
      const tLbl = point.T >= 1 ? `${fmt(point.T, 3)} MeV` : `${fmt(point.T * 1000, 3)} keV`;
      plotAbund.o.title = `Abundances vs time · t = ${fmt(point.t, 3)} s, T = ${tLbl}`;
      plotAbund.draw(() => {
        const xs = run.map((r) => r.t);
        // full traces, faint
        for (let i = 0; i < 7; i++) {
          const ys = run.map((r) => Math.max(r.Y[i], 1e-13));
          plotAbund.line(xs, ys, { color: spColor(pal, i), alpha: 0.3, width: 1.5, dash: SP_DASH[i] });
        }
        // the part already "lived through", bright
        const k = run.findIndex((r) => r.t > point.t);
        const n = k < 0 ? run.length : k;
        for (let i = 0; i < 7; i++) {
          const ys = run.map((r) => Math.max(r.Y[i], 1e-13));
          plotAbund.line(xs, ys, { color: spColor(pal, i), width: 1.75, dash: SP_DASH[i], n });
        }
        plotAbund.vline(1.0, { color: pal.muted });
        plotAbund.vline(180, { color: pal.muted });
        const { ctx } = plotAbund;
        const yl = plotAbund.m.t + plotAbund.ph - 8;
        const nar = plotAbund.pw < 420;
        plotAbund.text(nar ? 'freeze-out' : 'n/p freeze-out', plotAbund.px(1.0) + 4, yl - (nar ? 14 : 0), { color: pal.muted });
        plotAbund.text(nar ? 'D bottleneck' : 'D bottleneck breaks', plotAbund.px(180) - 4, yl, { color: pal.muted, align: 'right' });
        ctx.textAlign = 'left';
        // moving time cursor
        plotAbund.vline(point.t, { color: pal.fg, width: 1, dash: [], alpha: 0.6 });
        for (let i = 0; i < 7; i++) {
          plotAbund.point(point.t, Math.max(point.Y[i], 1e-13), { color: spColor(pal, i), r: 3.5 });
        }
      });
      legendRow(plotAbund.ctx, SP_LABEL.map((l, i) => [l, spColor(pal, i), SP_DASH[i]] as [string, string, number[]?]),
        plotAbund.m.l, 30, plotAbund.m.l + plotAbund.pw, pal.fg);

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
        // approximate observational bands: D/H (quasar absorbers), Y_p (metal-poor H II regions),
        // ⁷Li/H (Spite plateau in old halo stars)
        const { ctx: c2 } = plotSchramm;
        const band = (lo: number, hi: number, color: string, label: string) => {
          const y0 = plotSchramm.py(hi), y1 = plotSchramm.py(lo);
          c2.save();
          c2.globalAlpha = 0.16; c2.fillStyle = color;
          c2.fillRect(plotSchramm.m.l, y0, plotSchramm.pw, Math.max(2, y1 - y0));
          c2.restore();
          plotSchramm.text(label, plotSchramm.m.l + plotSchramm.pw - 4, y0 - 3, { color, align: 'right', size: 10 });
        };
        band(2.45e-5, 2.6e-5, pal.series[1], 'observed D/H');
        band(0.0242, 0.0248, pal.series[3], 'observed Yₚ');
        band(1.3e-10, 1.9e-10, pal.series[2], 'observed ⁷Li/H (old stars)');

        plotSchramm.line(xs, yD, { color: pal.series[1] });
        plotSchramm.line(xs, yHe3, { color: pal.series[4] });
        plotSchramm.line(xs, yLi, { color: pal.series[2] });
        plotSchramm.line(xs, yYp.map((v) => v / 10), { color: pal.series[3] }); // Yp scaled onto same log decade for display
        plotSchramm.vline(eta, { color: pal.accent, width: 1.5 });
      });
      legendRow(plotSchramm.ctx, [['D/H', pal.series[1]], ['³He/H', pal.series[4]], ['⁷Li/H', pal.series[2]], ['Yₚ / 10', pal.series[3]]],
        plotSchramm.m.l, 30, plotSchramm.m.l + plotSchramm.pw, pal.fg);
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

    // Side by side when there is room, stacked on phones.
    const twoCol = wrap.style.gridTemplateColumns;
    const cols = () => {
      const narrow = host.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : twoCol;
      const first = wrap.firstElementChild as HTMLElement;
      first.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      first.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    };
    cols();
    new ResizeObserver(cols).observe(host);
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
