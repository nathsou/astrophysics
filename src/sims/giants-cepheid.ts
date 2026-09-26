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
const Q = 0.036; // days, calibration constant for the toy relation
// Classical Cepheid P-L (Leavitt law), V-band, approximate: M_V = -2.81 log10(P/day) - 1.43
function M_V(P_day: number) { return -2.81 * Math.log10(P_day) - 1.43; }

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const hrStage = createStage(wrap, { aspect: 1 });
    const plStage = createStage(wrap, { aspect: 1 });
    hrStage.el.style.borderRight = '1px solid var(--rule)';

    const hrPlot = new Plot(hrStage.canvas, {
      x: { min: 4.1, max: 3.55, label: 'log T_eff (K)' },
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

    function strip(logTv: number) {
      // instability strip: a band around a line in the HR plane
      return { center: 3.83 - 0.06 * (logL - 2.0) };
    }

    function periodFromState(): number {
      // mean density from L = 4 pi R^2 sigma T^4 and M-L relation guess (~ M ~ L^0.25 crude), then P ~ Q / sqrt(rho/rho_sun)
      const R2 = 10 ** logL / (10 ** logT / 5772) ** 4; // (R/Rsun)^2
      const R = Math.sqrt(Math.max(R2, 1e-6));
      const M = Math.pow(10 ** logL, 0.25); // crude M-L guess for a pulsating giant, Msun
      const rhoRel = M / (R * R * R);
      return Q / Math.sqrt(Math.max(rhoRel, 1e-6)) * 10; // scaled to land Cepheids in the 1-100 day range
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
        const xTop = hrPlot.px(strip(hrPlot.o.y.max).center - 0.02), xTop2 = hrPlot.px(strip(hrPlot.o.y.max).center + 0.02);
        const xBot = hrPlot.px(strip(hrPlot.o.y.min).center - 0.02), xBot2 = hrPlot.px(strip(hrPlot.o.y.min).center + 0.02);
        ctx.beginPath();
        ctx.moveTo(xTop, top); ctx.lineTo(xTop2, top); ctx.lineTo(xBot2, bot); ctx.lineTo(xBot, bot); ctx.closePath();
        ctx.fill();
        ctx.restore();
        // star
        const x = hrPlot.px(logT), y = hrPlot.py(logL);
        ctx.fillStyle = blackbodyCSS(10 ** logT, 1);
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.stroke();
      });
      const P = periodFromState();
      plPlot.draw(() => {
        plPlot.fn((P) => M_V(P), { color: pal.series[1], width: 2 });
        const x = plPlot.px(P), y = plPlot.py(M_V(P));
        plPlot.ctx.fillStyle = pal.accent;
        plPlot.ctx.beginPath(); plPlot.ctx.arc(x, y, 5, 0, Math.PI * 2); plPlot.ctx.fill();
      });
      const dist_pc = Math.pow(10, (appMag - M_V(P) + 5) / 5);
      readP.set(`${fmt(P, 3)} days`);
      readMv.set(`${fmt(M_V(P), 3)} mag`);
      readDist.set(`${fmt(dist_pc, 4)} pc (${fmt(dist_pc / 1e6, 3)} Mpc)`);
    }

    let dragging = false;
    function toData(e: PointerEvent) {
      const r = hrStage.canvas.getBoundingClientRect();
      return { logT: hrPlot.dx(e.clientX - r.left), logL: hrPlot.dy(e.clientY - r.top) };
    }
    hrStage.canvas.addEventListener('pointerdown', (e) => { dragging = true; const d = toData(e); logT = d.logT; logL = d.logL; loop.invalidate(); });
    window.addEventListener('pointermove', (e) => { if (dragging) { const d = toData(e); logT = Math.min(4.1, Math.max(3.55, d.logT)); logL = Math.min(4.5, Math.max(1.5, d.logL)); loop.invalidate(); } });
    window.addEventListener('pointerup', () => (dragging = false));

    const loop = new Loop(() => {}, render, 1 / 15);
    hrStage.onResize(() => loop.invalidate());
    plStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Apparent magnitude m_V', { min: 5, max: 25, value: appMag, step: 0.1 }, (v) => { appMag = v; loop.invalidate(); });

    const readP = panel.readout('Period');
    const readMv = panel.readout('Absolute mag M_V');
    const readDist = panel.readout('Implied distance');

    loop.invalidate();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
