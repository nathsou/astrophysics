// Secondary figure: the instability strip and the Cepheid period-luminosity relation.
// Left: an HR diagram with a diagonal instability strip; drag a point across it and see
// its pulsation period computed from the period-mean-density relation. Right: the P-L
// relation with a draggable period slider that reads off luminosity and, given an
// apparent magnitude, a distance (Leavitt's method — link to Chapter 25).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

// Period-mean-density relation: P * sqrt(<rho>/rho_sun) ~ Q (~0.03-0.09 d for classical Cepheids).
const Q = 0.04; // days: pulsation constant for classical Cepheids (fundamental mode)
const HALF_WIDTH = 0.045; // half-width of the strip in log T_eff
// Classical Cepheid P-L (Leavitt law), V-band, approximate: M_V = -2.81 log10(P/day) - 1.43
function M_V(P_day: number) { return -2.81 * Math.log10(P_day) - 1.43; }

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    // side by side on wide screens, stacked on phones
    const ro = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)';
      hrStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      hrStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    ro.observe(wrap);
    onDestroy(() => ro.disconnect());
    const hrStage = createStage(wrap, { aspect: 1 });
    const plStage = createStage(wrap, { aspect: 1 });
    hrStage.el.style.borderRight = '1px solid var(--rule)';

    const hrPlot = new Plot(hrStage.canvas, {
      // reversed axis (hot on the left, as in every HR diagram): explicit ticks
      x: { min: 4.1, max: 3.55, label: 'log T_eff (K)  (hot ← → cool)', ticks: [4.0, 3.9, 3.8, 3.7, 3.6], format: (v) => v.toFixed(1) },
      y: { min: 1.5, max: 4.5, label: 'log L / L☉' },
      title: 'Instability strip — drag the star',
    });
    const plPlot = new Plot(plStage.canvas, {
      x: { min: 1, max: 100, log: true, label: 'Period (days)' },
      y: { min: -6, max: -1, label: 'M_V (mag)' },
      title: 'Period–luminosity relation (Leavitt law)',
    });

    let logT = 3.78, logL = 3.3;
    let appMag = 12.0; // apparent V magnitude, for the distance readout

    function strip(logLv: number) {
      // instability strip: a band that leans to cooler temperatures at higher luminosity
      return { center: 3.83 - 0.06 * (logLv - 2.0) };
    }
    const inStrip = () => Math.abs(logT - strip(logL).center) <= HALF_WIDTH;

    function periodFromState(): number {
      // R from L = 4πR²σT⁴, M from a Cepheid mass–luminosity relation (log L ≈ 0.72 + 3.35 log M),
      // then the period–mean-density relation P = Q / √(ρ̄/ρ̄☉).
      const R2 = 10 ** logL / (10 ** logT / 5772) ** 4; // (R/R☉)²
      const R = Math.sqrt(Math.max(R2, 1e-6));
      const M = 10 ** ((logL - 0.72) / 3.35);
      const rhoRel = M / (R * R * R);
      return Q / Math.sqrt(Math.max(rhoRel, 1e-12));
    }

    function render() {
      hrPlot.resize(hrStage.width, hrStage.height, hrStage.dpr);
      plPlot.resize(plStage.width, plStage.height, plStage.dpr);
      hrPlot.draw(() => {
        const ctx = hrPlot.ctx;
        // shaded instability strip
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = pal.accent;
        const top = hrPlot.py(hrPlot.o.y.max), bot = hrPlot.py(hrPlot.o.y.min);
        const xTop = hrPlot.px(strip(hrPlot.o.y.max).center - HALF_WIDTH), xTop2 = hrPlot.px(strip(hrPlot.o.y.max).center + HALF_WIDTH);
        const xBot = hrPlot.px(strip(hrPlot.o.y.min).center - HALF_WIDTH), xBot2 = hrPlot.px(strip(hrPlot.o.y.min).center + HALF_WIDTH);
        ctx.beginPath();
        ctx.moveTo(xTop, top); ctx.lineTo(xTop2, top); ctx.lineTo(xBot2, bot); ctx.lineTo(xBot, bot); ctx.closePath();
        ctx.fill();
        ctx.restore();
        hrPlot.text('instability strip', hrPlot.px(strip(4.2).center + HALF_WIDTH) - 4, hrPlot.py(4.2), { color: pal.accent, size: 11, align: 'right' });
        // star: pulsates (in radius and temperature) while it sits inside the strip
        const puls = inStrip() ? Math.sin((2 * Math.PI * clock) / 1.2) : 0;
        const x = hrPlot.px(logT), y = hrPlot.py(logL);
        ctx.fillStyle = blackbodyCSS(10 ** logT * (1 + 0.04 * puls), 1);
        ctx.beginPath(); ctx.arc(x, y, 8 * (1 + 0.18 * puls), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const P = periodFromState();
      const on = inStrip();
      plPlot.draw(() => {
        plPlot.fn((P) => M_V(P), { color: pal.series[1], width: 2 });
        if (on) plPlot.point(P, M_V(P), { r: 5, color: pal.accent, stroke: pal.fg });
        else plPlot.text('star outside the strip: no pulsation', plPlot.m.l + 10, plPlot.m.t + plPlot.ph - 10, { color: pal.muted, size: 11 });
      });
      const dist_pc = Math.pow(10, (appMag - M_V(P) + 5) / 5);
      readP.set(on ? `${fmt(P, 3)} days` : '— (not pulsating)');
      readMv.set(on ? `${fmt(M_V(P), 3)} mag` : '—');
      readDist.set(on ? `${fmt(dist_pc, 4)} pc (${fmt(dist_pc / 1e6, 3)} Mpc)` : '—');
    }

    let dragging = false;
    function toData(e: PointerEvent) {
      const r = hrStage.canvas.getBoundingClientRect();
      return { logT: hrPlot.dx(e.clientX - r.left), logL: hrPlot.dy(e.clientY - r.top) };
    }
    const cv = hrStage.canvas;
    cv.style.touchAction = 'none';
    cv.style.cursor = 'grab';
    const moveTo = (e: PointerEvent) => { const d = toData(e); logT = Math.min(4.1, Math.max(3.55, d.logT)); logL = Math.min(4.5, Math.max(1.5, d.logL)); loop.invalidate(); };
    cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); moveTo(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) moveTo(e); });
    cv.addEventListener('pointerup', () => (dragging = false));
    cv.addEventListener('pointercancel', () => (dragging = false));

    let clock = 0;
    const loop = new Loop(null, (_a, frameDt) => { clock += frameDt; render(); });
    hrStage.onResize(() => loop.invalidate());
    plStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Apparent magnitude m_V', { min: 5, max: 25, value: appMag, step: 0.1 }, (v) => { appMag = v; loop.invalidate(); });

    const readP = panel.readout('Period');
    const readMv = panel.readout('Absolute mag M_V');
    const readDist = panel.readout('Implied distance');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
